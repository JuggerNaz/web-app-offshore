"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ClipboardCheck, LifeBuoy, Bot, ChevronRight, Building2, Search, ChevronDown, Check, AlertTriangle, CheckCircle2, AlertCircle, HelpCircle, Activity, Hourglass, Loader2 } from "lucide-react";
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

function getInitialInspectionState(key: string, paramName?: string): string {
    if (typeof window === "undefined") return "";
    try {
        const params = new URLSearchParams(window.location.search);
        
        if (key === "inspection_sow") {
            const querySow = params.get("sow");
            const querySowReport = params.get("sowReport");
            if (querySow && querySowReport) return `${querySow}-${querySowReport}`;
            if (querySow) return querySow;
        } else if (paramName) {
            const queryVal = params.get(paramName);
            if (queryVal) return queryVal;
        }

        return sessionStorage.getItem(key) || "";
    } catch (_) {
        return "";
    }
}

export default function InspectionLanding() {
    const router = useRouter();
    const supabase = createClient();

    const [jobPacks, setJobPacks] = useState<JobPack[]>([]);
    const [sowReports, setSOWReports] = useState<SOWReport[]>([]);
    const [rawSowItems, setRawSowItems] = useState<any[]>([]);
    const [sowInspRecords, setSowInspRecords] = useState<any[]>([]);
    const [anomalyCount, setAnomalyCount] = useState<number>(0);
    const [anomalyStats, setAnomalyStats] = useState<{ total: number; rov: number; dive: number }>({ total: 0, rov: 0, dive: 0 });
    const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
    const [jobPacksLoading, setJobPacksLoading] = useState<boolean>(false);
    const [sowReportsLoading, setSowReportsLoading] = useState<boolean>(false);

    const [mounted, setMounted] = useState(false);
    const [selectedJobPack, setSelectedJobPack] = useState<string>("");
    const [selectedStructure, setSelectedStructure] = useState<string>("");
    const [selectedSOW, setSelectedSOW] = useState<string>("");
    const [selectedMode, setSelectedMode] = useState<string>("ROV");
    const [loading, setLoading] = useState(true);

    const prevStructureRef = useRef<string>("");
    const prevJobPackRef = useRef<string>("");

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

    // State to track collapsed structure groups (platforms/pipelines)
    const [collapsedStructGroups, setCollapsedStructGroups] = useState<Record<string, boolean>>({});

    const toggleStructGroup = (group: string) => {
        setCollapsedStructGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const [allStructures, setAllStructures] = useState<Structure[]>([]);

    // Derive job packs that are assigned to the selected structure, sorted by start date desc
    const jobPacksForSelectedStructure = useMemo(() => {
        if (!selectedStructure) return [];
        const rawId = selectedStructure.replace(/^(platform|pipeline)-/, "");
        return jobPacks.filter((jp) => {
            if (!jp.structures || jp.structures.length === 0) return true;
            return jp.structures.some((s) => {
                const sIdStr = String(s.id).replace(/^(platform|pipeline)-/, "");
                return s.id.toString() === selectedStructure || sIdStr === rawId;
            });
        }).sort((a, b) => {
            if (!a.start_date) return 1;
            if (!b.start_date) return -1;
            return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        });
    }, [jobPacks, selectedStructure]);

    const selectedJobPackData = jobPacks.find((jp) => jp.id.toString() === selectedJobPack);
    const selectedStructureData = useMemo(() => {
        if (!selectedStructure || allStructures.length === 0) return undefined;
        const rawSelId = selectedStructure.replace(/^(platform|pipeline)-/, "");
        return allStructures.find((s) => {
            if (s.id.toString() === selectedStructure) return true;
            const rawSId = s.id.toString().replace(/^(platform|pipeline)-/, "");
            return rawSId === rawSelId;
        });
    }, [allStructures, selectedStructure]);
    const selectedSOWData = sowReports.find((s) => `${s.sow_id}-${s.item_no}` === selectedSOW || s.report_number === selectedSOW);

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

    const groupedStructures = useMemo(() => {
        const platforms = filteredStructures.filter((s) => (s.type || "platform").toLowerCase() === "platform");
        const pipelines = filteredStructures.filter((s) => (s.type || "platform").toLowerCase() === "pipeline");
        return { platforms, pipelines };
    }, [filteredStructures]);

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

    // Load structures and restore persisted state safely on mount (prevents SSR hydration mismatch)
    useEffect(() => {
        setMounted(true);
        loadStructures();

        const initialStructure = getInitialInspectionState("inspection_structure", "structure");
        const initialJobPack = getInitialInspectionState("inspection_jobpack", "jobpack");
        const initialSow = getInitialInspectionState("inspection_sow");
        const initialMode = getInitialInspectionState("inspection_mode", "mode") || "ROV";

        if (initialStructure) {
            setSelectedStructure(initialStructure);
            prevStructureRef.current = initialStructure;
        }
        if (initialJobPack) {
            setSelectedJobPack(initialJobPack);
            prevJobPackRef.current = initialJobPack;
        }
        if (initialSow) setSelectedSOW(initialSow);
        if (initialMode) setSelectedMode(initialMode);
    }, []);

    // Sync URL query parameters taking priority if provided
    useEffect(() => {
        if (allStructures.length > 0 && typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const queryStructure = params.get("structure");
            const queryJobPack = params.get("jobpack");
            const querySow = params.get("sow");
            const querySowReport = params.get("sowReport");
            const queryMode = params.get("mode");

            if (queryStructure && queryStructure !== selectedStructure) {
                setSelectedStructure(queryStructure);
            }
            if (queryJobPack && queryJobPack !== selectedJobPack) {
                setSelectedJobPack(queryJobPack);
            }
            let activeSow = querySow && querySowReport ? `${querySow}-${querySowReport}` : querySow;
            if (activeSow && activeSow !== selectedSOW) {
                setSelectedSOW(activeSow);
            }
            if (queryMode && queryMode !== selectedMode) {
                setSelectedMode(queryMode);
            }
        }
    }, [allStructures]);

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
        } else {
            sessionStorage.removeItem("inspection_jobpack");
        }
    }, [selectedJobPack]);

    // Auto-normalize selectedStructure ID to canonical prefixed ID (e.g. "pipeline-5" or "platform-5")
    useEffect(() => {
        if (selectedStructureData && selectedStructure !== selectedStructureData.id) {
            setSelectedStructure(selectedStructureData.id);
            sessionStorage.setItem("inspection_structure", selectedStructureData.id);
        }
    }, [selectedStructureData, selectedStructure]);

    useEffect(() => {
        if (selectedStructure) {
            sessionStorage.setItem("inspection_structure", selectedStructure);

            const rawPrev = prevStructureRef.current ? prevStructureRef.current.replace(/^(platform|pipeline)-/, "") : "";
            const rawCurr = selectedStructure.replace(/^(platform|pipeline)-/, "");

            // Immediate Reset of downstream selections ONLY if structure actually changed (raw ID comparison)
            if (rawPrev && rawPrev !== rawCurr) {
                setSelectedJobPack("");
                setSelectedSOW("");
                setSelectedMode(prev => prev || "ROV");
                setSOWReports([]);
                setRawSowItems([]);
                setSowInspRecords([]);
                setAnomalyCount(0);
                sessionStorage.removeItem("inspection_jobpack");
                sessionStorage.removeItem("inspection_sow");
            }
            prevStructureRef.current = selectedStructure;

            loadJobPacksForStructure(selectedStructure);
        } else {
            setJobPacks([]);
            setSelectedJobPack("");
            setSelectedSOW("");
            setSOWReports([]);
            setRawSowItems([]);
            setSowInspRecords([]);
            setAnomalyCount(0);
            sessionStorage.removeItem("inspection_structure");
            sessionStorage.removeItem("inspection_jobpack");
            sessionStorage.removeItem("inspection_sow");
            prevStructureRef.current = "";
        }
    }, [selectedStructure]);

    useEffect(() => {
        if (selectedSOW) {
            sessionStorage.setItem("inspection_sow", selectedSOW);
        } else {
            sessionStorage.removeItem("inspection_sow");
        }
    }, [selectedSOW]);

    useEffect(() => {
        if (selectedMode) {
            sessionStorage.setItem("inspection_mode", selectedMode);
        } else {
            sessionStorage.removeItem("inspection_mode");
        }
    }, [selectedMode]);

    // Load SOW reports when structure and job pack are selected
    useEffect(() => {
        if (selectedStructure && selectedJobPack) {
            // Immediate Reset of downstream SOW selection if job pack changed
            if (prevJobPackRef.current && prevJobPackRef.current !== selectedJobPack) {
                setSelectedSOW("");
                setSelectedMode(prev => prev || "ROV");
                setSOWReports([]);
                setRawSowItems([]);
                setSowInspRecords([]);
                setAnomalyCount(0);
                sessionStorage.removeItem("inspection_sow");
            }
            prevJobPackRef.current = selectedJobPack;

            loadSOWReports(selectedJobPack, selectedStructure);
        } else {
            setSOWReports([]);
            setRawSowItems([]);
            setSowInspRecords([]);
            setAnomalyCount(0);
            prevJobPackRef.current = "";
        }
    }, [selectedStructure, selectedJobPack]);

    // Fetch anomaly count and inspection records when SOW report is selected
    useEffect(() => {
        let isMounted = true;
        if (selectedStructure && selectedJobPack && selectedSOWData) {
            const structId = selectedStructure;
            const jpId = selectedJobPack;
            const sowReportNo = selectedSOWData.report_number;
            
            setSummaryLoading(true);
            
            Promise.all([
                fetchAnomalyCount(structId, jpId, sowReportNo),
                fetchSowInspRecords(structId, jpId, sowReportNo)
            ]).finally(() => {
                if (isMounted) setSummaryLoading(false);
            });
        } else {
            setAnomalyCount(0);
            setAnomalyStats({ total: 0, rov: 0, dive: 0 });
            setSowInspRecords([]);
            setSummaryLoading(false);
        }

        return () => {
            isMounted = false;
        };

        async function fetchSowInspRecords(structId: string, jpId: string, sowReportNo: string) {
            try {
                const rawId = structId.includes("-") ? structId.split("-")[1] : structId;
                const cacheKey = `sow_records_${rawId}_${jpId}_${sowReportNo || 'all'}`;

                // Instant 0ms cache check (Stale-While-Revalidate)
                try {
                    const cached = sessionStorage.getItem(cacheKey);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            setSowInspRecords(parsed);
                        }
                    }
                } catch (_) {}

                // Count total records first for parallel batching
                let countQuery = supabase
                    .from("insp_records")
                    .select("insp_id", { count: "exact", head: true })
                    .eq("structure_id", parseInt(rawId))
                    .eq("jobpack_id", parseInt(jpId));

                if (sowReportNo && sowReportNo !== "Unassigned Items" && sowReportNo !== "N/A") {
                    countQuery = countQuery.or(`sow_report_no.eq."${sowReportNo}",sow_report_no.is.null`);
                }

                const { count: totalCount } = await countQuery;
                const total = totalCount || 0;
                const batchSize = 1000;
                const numBatches = Math.max(1, Math.ceil(total / batchSize));

                // Fetch all pages in parallel to minimize satellite round-trip latency
                const promises = [];
                for (let i = 0; i < numBatches; i++) {
                    const offset = i * batchSize;
                    let query = supabase
                        .from("insp_records")
                        .select("insp_id, fp_kp, status, has_anomaly, elevation, inspection_type_code, inspection_data, dive_job_id, rov_job_id")
                        .eq("structure_id", parseInt(rawId))
                        .eq("jobpack_id", parseInt(jpId))
                        .range(offset, offset + batchSize - 1);

                    if (sowReportNo && sowReportNo !== "Unassigned Items" && sowReportNo !== "N/A") {
                        query = query.or(`sow_report_no.eq."${sowReportNo}",sow_report_no.is.null`);
                    }
                    promises.push(query);
                }

                const results = await Promise.all(promises);
                const allRecords: any[] = [];
                for (const res of results) {
                    if (res.data && res.data.length > 0) {
                        allRecords.push(...res.data);
                    }
                }

                setSowInspRecords(allRecords);
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify(allRecords));
                } catch (_) {}
            } catch (err) {
                console.error("Error fetching sow inspection records:", err);
            }
        }

        async function fetchAnomalyCount(structId: string, jpId: string, sowReportNo: string) {
            try {
                // Parse prefix e.g., platform-1 or pipeline-1
                const rawId = structId.includes("-") ? structId.split("-")[1] : structId;
                const numRawId = parseInt(rawId);
                const numJpId = parseInt(jpId);

                // 1. Direct query against insp_anomalies joined with insp_records
                let anomQuery = supabase
                    .from("insp_anomalies")
                    .select("anomaly_id, inspection_id, insp_records!inner(insp_id, structure_id, jobpack_id, sow_report_no, rov_job_id, dive_job_id, inspection_type_code)")
                    .eq("insp_records.structure_id", numRawId)
                    .eq("insp_records.jobpack_id", numJpId);

                const sNoUpper = (sowReportNo || "").trim().toUpperCase();
                if (sNoUpper && sNoUpper !== "UNASSIGNED ITEMS" && sNoUpper !== "N/A" && sNoUpper !== "ALL") {
                    anomQuery = anomQuery.or(`sow_report_no.eq."${sowReportNo}",sow_report_no.is.null`, { foreignTable: "insp_records" });
                }

                const { data: anomData, error: anomErr } = await anomQuery;
                if (!anomErr && anomData) {
                    let total = anomData.length;
                    let rov = 0;
                    let dive = 0;
                    anomData.forEach((a: any) => {
                        const r = a.insp_records || {};
                        const isDive = !!r.dive_job_id || String(r.inspection_type_code || "").toUpperCase().startsWith("D");
                        if (isDive) dive++;
                        else rov++;
                    });
                    setAnomalyCount(total);
                    setAnomalyStats({ total, rov, dive });
                    return;
                }

                // 2. Fallback: Paginated loop through insp_records
                let allRecs: any[] = [];
                let page = 0;
                const pageSize = 1000;
                let hasMore = true;

                while (hasMore) {
                    const { data: pData, error: pErr } = await supabase
                        .from("insp_records")
                        .select("insp_id, has_anomaly, status, sow_report_no, rov_job_id, dive_job_id, inspection_type_code")
                        .eq("structure_id", numRawId)
                        .eq("jobpack_id", numJpId)
                        .order("inspection_date", { ascending: false })
                        .order("inspection_time", { ascending: false })
                        .range(page * pageSize, (page + 1) * pageSize - 1);

                    if (pErr || !pData || pData.length === 0) {
                        hasMore = false;
                    } else {
                        allRecs.push(...pData);
                        if (pData.length < pageSize) hasMore = false;
                        else page++;
                    }
                }

                const relevantRecs = allRecs.filter((r: any) => {
                    if (!sNoUpper || sNoUpper === "UNASSIGNED ITEMS" || sNoUpper === "N/A" || sNoUpper === "ALL") return true;
                    const rSow = String(r.sow_report_no || "").trim().toUpperCase();
                    return !rSow || rSow === sNoUpper;
                });

                const flaggedRecs = relevantRecs.filter((r: any) => r.has_anomaly || String(r.status || "").toLowerCase() === "anomaly");
                let total = flaggedRecs.length;
                let rov = 0;
                let dive = 0;
                flaggedRecs.forEach((r: any) => {
                    const isDive = !!r.dive_job_id || String(r.inspection_type_code || "").toUpperCase().startsWith("D");
                    if (isDive) dive++;
                    else rov++;
                });

                setAnomalyCount(total);
                setAnomalyStats({ total, rov, dive });
            } catch (err) {
                console.error("Error fetching anomaly count:", err);
            }
        }
    }, [selectedStructure, selectedJobPack, selectedSOWData, supabase]);

    // Compute SOW stats for the currently selected report number
    const sowReportStats = useMemo(() => {
        if (!selectedSOWData) return null;

        const currentReportItems = rawSowItems.filter(
            (item) => item.report_number === selectedSOWData.report_number
        );

        const isPipeline = selectedStructureData?.type === "pipeline";

        const total = currentReportItems.length > 0 ? currentReportItems.length : sowInspRecords.length;
        if (total === 0 && !isPipeline) return null;

        const isRovItem = (item: any) => {
            const code = String(item.inspection_code || item.inspection_type_code || "").trim().toUpperCase();
            const desc = String(item.scope_description || item.inspection_name || item.notes || "").toUpperCase();
            if (code.startsWith("R") && code !== "RISER" && code !== "RB") return true;
            if (desc.includes("ROV")) return true;
            return false;
        };

        const isDivingItem = (item: any) => {
            const code = String(item.inspection_code || item.inspection_type_code || "").trim().toUpperCase();
            const desc = String(item.scope_description || item.inspection_name || item.notes || "").toUpperCase();
            if (code.startsWith("D") && code !== "DEBRIS" && code !== "DK") return true;
            if (["BSINS", "CVINS", "ACFMC", "MPINS", "SZONE", "SANI", "ANMAIN"].includes(code)) return true;
            if (desc.includes("DIVING") || desc.includes("DIVE")) return true;
            return false;
        };

        const completedItems = currentReportItems.filter((item) => String(item.status || "").toLowerCase() === "completed");
        const incompleteItems = currentReportItems.filter((item) => ["incomplete", "skipped"].includes(String(item.status || "").toLowerCase()));
        const pendingItems = currentReportItems.filter(
            (item) => !item.status || String(item.status || "").toLowerCase() === "pending"
        );

        let rovCompleted = 0;
        let diveCompleted = 0;
        let rovIncomplete = 0;
        let diveIncomplete = 0;
        let rovPending = 0;
        let divePending = 0;

        let fieldJoints = 0;
        let anodes = 0;
        let spans = 0;
        let burials = 0;
        let crossings = 0;
        let cpReadings = 0;

        // Process SOW planned items
        currentReportItems.forEach((item) => {
            const code = String(item.inspection_code || "").toUpperCase();
            const desc = String(item.scope_description || item.notes || "").toUpperCase();
            const status = String(item.status || "").toLowerCase().trim();

            const isDive = isDivingItem(item);

            if (status === "completed") {
                if (isDive) diveCompleted++;
                else rovCompleted++;
            } else if (status === "incomplete" || status === "skipped") {
                if (isDive) diveIncomplete++;
                else rovIncomplete++;
            } else {
                if (isDive) divePending++;
                else rovPending++;
            }

            if (code.includes("FJ") || desc.includes("JOINT") || desc.includes("FIELD JOINT")) fieldJoints++;
            if (code.includes("AN") || desc.includes("ANODE")) anodes++;
            if (code.includes("SPAN") || desc.includes("FREE SPAN") || desc.includes("SPAN")) spans++;
            if (code.includes("BUR") || desc.includes("BURIAL") || desc.includes("BURIED")) burials++;
            if (code.includes("CROSS") || desc.includes("CROSSING")) crossings++;
            if (code.includes("CP") || desc.includes("CP")) cpReadings++;
        });

        // Also aggregate live recorded inspection events
        if (sowInspRecords && sowInspRecords.length > 0) {
            sowInspRecords.forEach((rec) => {
                const code = String(rec.inspection_type_code || "").toUpperCase();
                const data = rec.inspection_data || {};
                const eventName = String(data.event_name || data.event_type || data.eventName || data.eventType || data.raw_event || data.raw_type || "").toUpperCase();
                const desc = String(data.event_description || data.findings || data.eventDescription || data.raw_descr || data.raw_comments || "").toUpperCase();
                const isDive = !!rec.dive_job_id;

                if (currentReportItems.length === 0) {
                    const status = String(rec.status || "").toLowerCase().trim();
                    if (status === "completed" || status === "anomaly") {
                        if (isDive) diveCompleted++;
                        else rovCompleted++;
                    } else if (status === "incomplete" || status === "skipped") {
                        if (isDive) diveIncomplete++;
                        else rovIncomplete++;
                    } else {
                        if (isDive) divePending++;
                        else rovPending++;
                    }
                }

                if (code.includes("FJ") || eventName.includes("FIELD JOINT") || eventName.includes("FJ") || desc.includes("FIELD JOINT") || desc.includes("JOINT")) fieldJoints++;
                if (code.includes("AN") || eventName.includes("ANODE") || eventName.includes("AN") || desc.includes("ANODE")) anodes++;
                if (code.includes("SPAN") || eventName.includes("SPAN") || desc.includes("SPAN")) spans++;
                if (code.includes("BUR") || eventName.includes("BURIAL") || eventName.includes("BURIED") || desc.includes("BURIAL") || desc.includes("BURIED")) burials++;
                if (code.includes("CROSS") || eventName.includes("CROSSING") || desc.includes("CROSSING") || data.crossing_line || data.c_lin) crossings++;
                if (code.includes("CP") || data.cp_fg_rdg || data.cp_rdg || data.cp_reading_mv || data.cp_fg || (data.cp_reading && data.cp_reading !== "") || (data.cp !== undefined && data.cp !== null && data.cp !== "")) cpReadings++;
            });
        }

        // Pipeline length progress calculations (in km)
        let totalPipelineLength = parseFloat(
            (selectedStructureData as any)?.metadata?.length_km || 
            (selectedStructureData as any)?.length_km || 
            (selectedStructureData as any)?.metadata?.length || 
            "10.000"
        ) || 10.000;

        let inspectedLength = 0;
        let skippedLength = 0;
        let pendingLength = totalPipelineLength;

        if (isPipeline) {
            let minKp = Infinity;
            let maxKp = -Infinity;

            // Check SOW item KPs
            currentReportItems.forEach((item) => {
                const status = String(item.status || "").toLowerCase();
                const rawKp = parseFloat(item.metadata?.kp || item.kp || "0");
                if (!isNaN(rawKp) && rawKp > 0) {
                    if (rawKp < minKp) minKp = rawKp;
                    if (rawKp > maxKp) maxKp = rawKp;
                }

                if (status === "incomplete" || status === "skipped") {
                    const skipLen = parseFloat(item.metadata?.skipped_length || "0") || 0.250;
                    skippedLength += skipLen;
                }
            });

            // Check insp_records KPs and skipped status
            if (sowInspRecords && sowInspRecords.length > 0) {
                sowInspRecords.forEach((rec) => {
                    const status = String(rec.status || "").toLowerCase();
                    const rawKp = parseFloat(rec.fp_kp || rec.inspection_data?.kp || rec.inspection_data?.fp_kp || "0");
                    if (!isNaN(rawKp) && rawKp > 0) {
                        if (rawKp < minKp) minKp = rawKp;
                        if (rawKp > maxKp) maxKp = rawKp;
                    }

                    if (status === "incomplete" || status === "skipped" || rec.inspection_data?.is_skipped) {
                        const skipLen = parseFloat(rec.inspection_data?.skipped_length || "0") || 0.250;
                        skippedLength += skipLen;
                    }
                });
            }

            if (minKp !== Infinity && maxKp !== -Infinity && maxKp >= minKp) {
                inspectedLength = maxKp - minKp;
            }
            
            // Fallback estimation if discrete events were captured without continuous start/end KP span
            if (inspectedLength === 0 && (completedItems.length > 0 || sowInspRecords.length > 0)) {
                const count = Math.max(completedItems.length, sowInspRecords.length);
                inspectedLength = Math.min(totalPipelineLength, count * 0.5);
            }

            if (inspectedLength > totalPipelineLength) {
                totalPipelineLength = inspectedLength;
            }
            pendingLength = Math.max(0, totalPipelineLength - inspectedLength - skippedLength);
        }

        const completionPercentage = isPipeline
            ? (totalPipelineLength > 0 ? Math.min(100, Math.max(0, (inspectedLength / totalPipelineLength) * 100)) : 100)
            : Math.round(((completedItems.length || rovCompleted + diveCompleted) / (total || 1)) * 100);

        const incompletePercentage = isPipeline
            ? (totalPipelineLength > 0 ? Math.min(100, Math.max(0, (skippedLength / totalPipelineLength) * 100)) : 0)
            : Math.round(((incompleteItems.length || rovIncomplete + diveIncomplete) / (total || 1)) * 100);

        const pendingPercentage = isPipeline
            ? Math.max(0, 100 - completionPercentage - incompletePercentage)
            : Math.max(0, 100 - completionPercentage - incompletePercentage);

        return {
            total,
            completed: completedItems.length || rovCompleted + diveCompleted,
            completedRov: rovCompleted,
            completedDive: diveCompleted,
            rovDone: rovCompleted,
            diveDone: diveCompleted,
            incomplete: incompleteItems.length || rovIncomplete + diveIncomplete,
            incompleteRov: rovIncomplete,
            incompleteDive: diveIncomplete,
            pending: pendingItems.length || rovPending + divePending,
            pendingRov: rovPending,
            pendingDive: divePending,
            fieldJoints,
            anodes,
            spans,
            burials,
            crossings,
            spansCrossings: spans + crossings,
            cpReadings,
            totalPipelineLength,
            inspectedLength,
            skippedLength,
            pendingLength,
            completionPercentage,
            incompletePercentage,
            pendingPercentage,
            isPipeline,
        };
    }, [selectedSOWData, rawSowItems, sowInspRecords, selectedStructureData]);

    // Helper to format a jobpack from API response (with metadata)
    function formatJobPack(jp: any, structureMap: Map<string, { title: string; type: "platform" | "pipeline" }>, fallbackStructureId?: string) {
        const structures = (jp.metadata as any)?.structures || [];
        let structureList = Array.isArray(structures)
            ? structures
                .map((s: any) => {
                    const rawSId = s.id || s.structure_id || s.platform_id || s.pipe_id || s.str_id || s.plat_id;
                    const sType = s.type?.toLowerCase() === "pipeline" || String(s.name || s.title || "").toLowerCase().includes("pipe") ? "pipeline" : "platform";
                    const lookupId = rawSId ? (String(rawSId).includes("-") ? String(rawSId) : `${sType}-${rawSId}`) : "";
                    const mapInfo = lookupId ? structureMap.get(lookupId) : undefined;
                    return {
                        id: lookupId || String(rawSId || ""),
                        name: mapInfo?.title || s.title || s.name || s.code || `Structure ${rawSId}`,
                        type: mapInfo?.type || sType
                    };
                })
                .filter((s: Structure) => s.id !== "" && s.name !== "")
            : [];

        if (structureList.length === 0 && fallbackStructureId) {
            const rawFallbackId = fallbackStructureId.replace(/^(platform|pipeline)-/, "");
            const fallbackType = fallbackStructureId.startsWith("pipeline") ? "pipeline" : "platform";
            const mapInfo = structureMap.get(fallbackStructureId);
            structureList = [{
                id: fallbackStructureId,
                name: mapInfo?.title || (jp.metadata as any)?.structure_name || `Structure ${rawFallbackId}`,
                type: (mapInfo?.type || fallbackType) as "platform" | "pipeline"
            }];
        }

        const structureNames = structureList.map((s: Structure) => s.name).join(", ");

        const start_date = (jp.metadata as any)?.istart;
        let year = "Unknown Year";
        if (start_date) {
            const match = start_date.match(/^(\d{4})/);
            if (match) year = match[1];
        }
        if (year === "Unknown Year" && jp.name) {
            const match = jp.name.match(/\b(19\d{2}|20\d{2})\b/);
            if (match) year = match[1];
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
    }

    // Store the structure map so it can be reused when fetching per-structure jobpacks
    const [structureMapRef] = useState<{ current: Map<string, { title: string; type: "platform" | "pipeline" }> }>({ current: new Map() });

    async function loadStructures() {
        try {
            const cached = sessionStorage.getItem("cached_all_structures");
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setAllStructures(parsed);
                    const map = new Map<string, { title: string; type: "platform" | "pipeline" }>();
                    parsed.forEach((s: any) => map.set(s.id, { title: s.name, type: s.type }));
                    structureMapRef.current = map;
                    setLoading(false);
                }
            }
        } catch (_) {}

        try {
            // Only fetch platforms and pipelines — no jobpack query (it times out due to huge metadata)
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

            structuresList.sort((a, b) => a.name.localeCompare(b.name));
            setAllStructures(structuresList);
            structureMapRef.current = structureMap;
            try {
                sessionStorage.setItem("cached_all_structures", JSON.stringify(structuresList));
            } catch (_) {}
        } catch (error) {
            console.error("Error loading structures:", error);
            toast.error("Failed to load structures");
        } finally {
            setLoading(false);
        }
    }

    async function loadJobPacksForStructure(structureId: string) {
        const rawId = structureId.replace(/^(platform|pipeline)-/, "");
        const cacheKey = `cached_jobpacks_${rawId}`;

        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setJobPacks(parsed);
                }
            }
        } catch (_) {}

        setJobPacksLoading(true);
        try {
            console.log("[Jobpack] Fetching jobpacks for structure:", rawId);
            const res = await fetch(`/api/jobpack?structure_id=${rawId}&limit=100`);
            if (!res.ok) {
                console.warn(`[Jobpack] API returned status ${res.status}`);
                setJobPacks([]);
                return;
            }
            const resJson = await res.json();
            const data = resJson.data || [];
            console.log("[Jobpack] Received", data.length, "jobpacks for structure", rawId);

            if (data.length > 0) {
                const formatted = data.map((jp: any) => formatJobPack(jp, structureMapRef.current, structureId));
                setJobPacks(formatted);
                try {
                    sessionStorage.setItem(cacheKey, JSON.stringify(formatted));
                } catch (_) {}
            } else {
                setJobPacks([]);
            }
        } catch (error) {
            console.error("Error loading jobpacks for structure:", error);
            setJobPacks([]);
        } finally {
            setJobPacksLoading(false);
        }
    }

    async function loadSOWReports(jobPackId: string, structureId: string) {
        const rawId = structureId.includes("-") ? structureId.split("-")[1] : structureId;
        const cacheKeySow = `cached_sows_${jobPackId}_${rawId}`;
        const cacheKeyItems = `cached_sow_items_${jobPackId}_${rawId}`;

        try {
            const cachedSows = sessionStorage.getItem(cacheKeySow);
            const cachedItems = sessionStorage.getItem(cacheKeyItems);
            if (cachedSows) {
                const parsed = JSON.parse(cachedSows);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setSOWReports(parsed);
                }
            }
            if (cachedItems) {
                const parsed = JSON.parse(cachedItems);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setRawSowItems(parsed);
                }
            }
        } catch (_) {}

        setSowReportsLoading(true);
        try {
            console.log("Loading SOW reports via API for job pack:", jobPackId, "structure:", structureId);
            const res = await fetch(`/api/sow?jobpack_id=${jobPackId}&structure_id=${rawId}`);
            if (!res.ok) {
                throw new Error(`Failed to fetch SOW reports: ${res.statusText}`);
            }
            const resJson = await res.json();
            const sow = resJson.data;

            console.log("Raw u_sow data from API:", sow);

            const sowData = sow ? [sow] : [];
            const itemsData = sow?.items || [];
            setRawSowItems(itemsData);
            try {
                sessionStorage.setItem(cacheKeyItems, JSON.stringify(itemsData));
            } catch (_) {}

            // Group by distinct report numbers (not individual inspection codes)
            const formatted: SOWReport[] = [];
            const reportNumbersSet = new Set<string>();

            sowData.forEach((sowItem: any) => {
                const reportArray = sowItem.report_numbers || [];
                
                if (reportArray.length > 0) {
                    reportArray.forEach((r: any) => {
                        const reportNum = String(r.number || "").trim();
                        if (!reportNum) return;
                        
                        const uniqueKey = `${sowItem.id}-${reportNum}`;
                        if (!reportNumbersSet.has(uniqueKey)) {
                            reportNumbersSet.add(uniqueKey);
                            formatted.push({
                                sow_id: sowItem.id,
                                item_no: reportNum, 
                                report_number: reportNum,
                                job_type: r.job_type || "",
                                scope_description: sowItem.structure_title || "Inspection Report",
                                inspection_method: "",
                                structure_id: sowItem.structure_id,
                            });
                        }
                    });
                } else {
                    // Fallback for older SOWs without defined report_numbers array
                    const sowItems = itemsData?.filter((item: any) => item.sow_id === sowItem.id) || [];
                    sowItems.forEach((item: any) => {
                        const reportNum = String(item.report_number || "").trim();
                        if (reportNum) {
                            const uniqueKey = `${sowItem.id}-${reportNum}`;
                            if (!reportNumbersSet.has(uniqueKey)) {
                                reportNumbersSet.add(uniqueKey);
                                formatted.push({
                                    sow_id: sowItem.id,
                                    item_no: reportNum,
                                    report_number: reportNum,
                                    job_type: "",
                                    scope_description: sowItem.structure_title || "Inspection Report",
                                    inspection_method: "",
                                    structure_id: sowItem.structure_id,
                                });
                            }
                        }
                    });
                }
            });

            // Also check insp_records for any recorded SOW report numbers for this jobpack
            try {
                const { data: distinctSows } = await supabase
                    .from("insp_records")
                    .select("sow_report_no")
                    .eq("jobpack_id", parseInt(jobPackId))
                    .eq("structure_id", parseInt(rawId))
                    .not("sow_report_no", "is", null);

                if (distinctSows && distinctSows.length > 0) {
                    distinctSows.forEach((r: any) => {
                        const reportNum = String(r.sow_report_no || "").trim();
                        if (!reportNum || reportNum === "N/A") return;
                        const uniqueKey = `${sow?.id || 0}-${reportNum}`;
                        if (!reportNumbersSet.has(uniqueKey)) {
                            reportNumbersSet.add(uniqueKey);
                            formatted.push({
                                sow_id: sow?.id || 0,
                                item_no: reportNum,
                                report_number: reportNum,
                                job_type: "ROV",
                                scope_description: sow?.structure_title || "Inspection Report",
                                inspection_method: "",
                                structure_id: parseInt(rawId),
                            });
                        }
                    });
                }
            } catch (inspSowErr) {
                console.error("Error querying insp_records distinct sow numbers:", inspSowErr);
            }

            if (formatted.length === 0) {
                formatted.push({
                    sow_id: sow?.id || 0,
                    item_no: "Unassigned",
                    report_number: "Unassigned Items",
                    job_type: "",
                    scope_description: sow?.structure_title || "Inspection Report",
                    inspection_method: "",
                    structure_id: parseInt(rawId),
                });
            }

            console.log("Formatted distinct SOW reports:", formatted);
            setSOWReports(formatted);

            // Helper to prioritize ROV mode by default unless no ROV items are found in the SOW
            const determineDefaultMode = (sowObj: any, reportNum: string, itemsList: any[]) => {
                const reportArray = sowObj?.report_numbers || [];
                const reportConfig = reportArray.find((r: any) => r?.number === reportNum);
                if (reportConfig && (reportConfig.job_type || "").toUpperCase() === 'ROV') {
                    return "ROV";
                }
                
                const currentReportItems = (itemsList || []).filter(
                    (item) => item?.report_number === reportNum
                );
                
                const rovCodes = ['NAVIG', 'RGVI', 'CP', 'RSWNI', 'SWNI', 'RICMI', 'ANODE', 'FMD', 'RFMD', 'RUTWT', 'RSEAB', 'SEABED', 'RWDI', 'RMGI', 'RSZCI', 'RSCOR', 'SCOUR', 'RRISI', 'JTISI', 'ITISI', 'RCASN', 'RCOND', 'BL', 'RG', 'SG', 'CU'];
                const hasRovItems = currentReportItems.some((item: any) => {
                    const code = (item?.inspection_code || item?.inspection_type_code || item?.inspection_type?.code || "").toUpperCase();
                    return code.startsWith('R') || rovCodes.includes(code);
                });
                
                if (hasRovItems) {
                    return "ROV";
                }
                
                const hasDiverConfig = reportConfig && (reportConfig.job_type || "").toUpperCase() === 'DIVING';
                const diverCodes = ['DGVI', 'GVINS', 'BSINS', 'CVINS', 'CLEAN', 'MPINS', 'UTWTK', 'SZONE', 'CPCLB', 'UTCLB', 'DMGI', 'ANMAIN', 'ACFMC', 'PLCO'];
                const hasDiverItems = currentReportItems.some((item: any) => {
                    const code = (item?.inspection_code || item?.inspection_type_code || item?.inspection_type?.code || "").toUpperCase();
                    return code.startsWith('D') || diverCodes.includes(code);
                });
                
                if (hasDiverConfig || hasDiverItems) {
                    return "DIVING";
                }
                
                return "ROV";
            };

            // Restore saved SOW if available in current formatted list
            if (formatted.length > 0) {
                const savedSOW = sessionStorage.getItem("inspection_sow") || "";
                const savedMode = sessionStorage.getItem("inspection_mode") || "";
                
                const matchingSow = savedSOW && formatted.find(f => 
                    `${f.sow_id}-${f.item_no}` === savedSOW || 
                    `${f.sow_id}-${f.report_number}` === savedSOW || 
                    f.report_number === savedSOW || 
                    f.item_no === savedSOW
                );
                if (matchingSow) {
                    setSelectedSOW(`${matchingSow.sow_id}-${matchingSow.item_no}`);
                    const defaultMode = determineDefaultMode(sow, matchingSow.report_number, itemsData);
                    setSelectedMode(savedMode || defaultMode || "ROV");
                } else if (savedSOW) {
                    setSelectedSOW(savedSOW);
                    if (savedMode) setSelectedMode(savedMode);
                }
            }
        } catch (error) {
            console.error("Error loading SOW reports:", error);
            toast.error("Failed to load SOW reports");
            setSOWReports([]);
            setSelectedSOW("");
            setSelectedMode(prev => prev || "ROV");
        } finally {
            setSowReportsLoading(false);
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
                                                                const isSelected = selectedStructure === struct.id.toString() ||
                                                                    (!!selectedStructure && !!struct.id && selectedStructure.replace(/^(platform|pipeline)-/, "") === struct.id.toString().replace(/^(platform|pipeline)-/, ""));
                                                                return (
                                                                    <div
                                                                        key={`jp-struct-${struct.id}`}
                                                                        onClick={() => {
                                                                            if (!isSelected) {
                                                                                setSelectedStructure(struct.id.toString());
                                                                                setSelectedSOW("");
                                                                                setSelectedMode(prev => prev || "ROV");
                                                                                sessionStorage.setItem("inspection_structure", struct.id.toString());
                                                                                sessionStorage.removeItem("inspection_sow");
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

                                                {/* All Structures List (Grouped by Structure Type) */}
                                                <div className="space-y-3">
                                                    {selectedJobPack && (
                                                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-t pt-2 mt-2">
                                                            All Structures
                                                        </div>
                                                    )}
                                                    {filteredStructures.length === 0 ? (
                                                        <div className="py-6 text-center text-sm text-slate-500 font-medium">No structure found.</div>
                                                    ) : (
                                                        <>
                                                            {/* Platforms Group */}
                                                             {groupedStructures.platforms.length > 0 && (
                                                                 <div className="space-y-1">
                                                                     <div
                                                                         onClick={() => toggleStructGroup("platforms")}
                                                                         className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/50 hover:bg-blue-100/70 dark:hover:bg-blue-900/60 rounded flex items-center justify-between cursor-pointer select-none transition-colors border border-blue-100 dark:border-blue-900/40"
                                                                     >
                                                                         <div className="flex items-center gap-1.5">
                                                                             {collapsedStructGroups["platforms"] ? (
                                                                                 <ChevronRight className="h-3.5 w-3.5 text-blue-500" />
                                                                             ) : (
                                                                                 <ChevronDown className="h-3.5 w-3.5 text-blue-500" />
                                                                             )}
                                                                             <span>Platforms</span>
                                                                         </div>
                                                                         <span className="text-[9px] bg-blue-200/60 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-1.5 py-0.5 rounded-full font-bold">{groupedStructures.platforms.length}</span>
                                                                     </div>
                                                                     {!collapsedStructGroups["platforms"] && groupedStructures.platforms.map((struct) => {
                                                                         const isSelected = selectedStructure === struct.id.toString() ||
                                                                             (!!selectedStructure && !!struct.id && selectedStructure.replace(/^(platform|pipeline)-/, "") === struct.id.toString().replace(/^(platform|pipeline)-/, ""));
                                                                         return (
                                                                             <div
                                                                                 key={`${struct.id}-${struct.name}`}
                                                                                 onClick={() => {
                                                                                     if (!isSelected) {
                                                                                         setSelectedStructure(struct.id.toString());
                                                                                         setSelectedSOW("");
                                                                                         setSelectedMode(prev => prev || "ROV");
                                                                                         sessionStorage.setItem("inspection_structure", struct.id.toString());
                                                                                         sessionStorage.removeItem("inspection_sow");
                                                                                     }
                                                                                     setOpenStruct(false);
                                                                                     setSearchStruct("");
                                                                                 }}
                                                                                 className={`relative flex justify-between cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${isSelected ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 font-bold border border-green-200 dark:border-green-900" : "text-slate-800 dark:text-slate-200"}`}
                                                                             >
                                                                                 <div className="flex items-center gap-2">
                                                                                     <Building2 className={`h-4 w-4 ${isSelected ? "text-green-600 dark:text-green-500" : "text-slate-400"}`} />
                                                                                     <span>{struct.name}</span>
                                                                                 </div>
                                                                                 {isSelected && (
                                                                                     <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                                                                                 )}
                                                                             </div>
                                                                         );
                                                                     })}
                                                                 </div>
                                                             )}

                                                             {/* Pipelines Group */}
                                                             {groupedStructures.pipelines.length > 0 && (
                                                                 <div className="space-y-1 mt-2">
                                                                     <div
                                                                         onClick={() => toggleStructGroup("pipelines")}
                                                                         className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/50 hover:bg-amber-100/70 dark:hover:bg-amber-900/60 rounded flex items-center justify-between cursor-pointer select-none transition-colors border border-amber-100 dark:border-amber-900/40"
                                                                     >
                                                                         <div className="flex items-center gap-1.5">
                                                                             {collapsedStructGroups["pipelines"] ? (
                                                                                 <ChevronRight className="h-3.5 w-3.5 text-amber-500" />
                                                                             ) : (
                                                                                 <ChevronDown className="h-3.5 w-3.5 text-amber-500" />
                                                                             )}
                                                                             <span>Pipelines</span>
                                                                         </div>
                                                                         <span className="text-[9px] bg-amber-200/60 dark:bg-amber-900 text-amber-900 dark:text-amber-100 px-1.5 py-0.5 rounded-full font-bold">{groupedStructures.pipelines.length}</span>
                                                                     </div>
                                                                     {!collapsedStructGroups["pipelines"] && groupedStructures.pipelines.map((struct) => {
                                                                         const isSelected = selectedStructure === struct.id.toString() ||
                                                                             (!!selectedStructure && !!struct.id && selectedStructure.replace(/^(platform|pipeline)-/, "") === struct.id.toString().replace(/^(platform|pipeline)-/, ""));
                                                                         return (
                                                                             <div
                                                                                 key={`${struct.id}-${struct.name}`}
                                                                                 onClick={() => {
                                                                                     if (!isSelected) {
                                                                                         setSelectedStructure(struct.id.toString());
                                                                                         setSelectedSOW("");
                                                                                         setSelectedMode(prev => prev || "ROV");
                                                                                         sessionStorage.setItem("inspection_structure", struct.id.toString());
                                                                                         sessionStorage.removeItem("inspection_sow");
                                                                                     }
                                                                                     setOpenStruct(false);
                                                                                     setSearchStruct("");
                                                                                 }}
                                                                                 className={`relative flex justify-between cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${isSelected ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 font-bold border border-green-200 dark:border-green-900" : "text-slate-800 dark:text-slate-200"}`}
                                                                             >
                                                                                 <div className="flex items-center gap-2">
                                                                                     <Building2 className={`h-4 w-4 ${isSelected ? "text-green-600 dark:text-green-500" : "text-slate-400"}`} />
                                                                                     <span>{struct.name}</span>
                                                                                 </div>
                                                                                 {isSelected && (
                                                                                     <Check className="h-4 w-4 text-green-600 dark:text-green-500" />
                                                                                 )}
                                                                             </div>
                                                                         );
                                                                     })}
                                                                 </div>
                                                             )}
                                                        </>
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
                                                disabled={!selectedStructure || jobPacksLoading || jobPacksForSelectedStructure.length === 0}
                                                className={`w-full justify-between h-auto py-2 px-3 font-normal bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 ${selectedJobPack ? "border-blue-300 dark:border-blue-700 ring-1 ring-blue-100 dark:ring-blue-900/40" : ""}`}
                                            >
                                                {jobPacksLoading ? (
                                                    <div className="flex items-center gap-2 text-sm text-slate-400 font-medium">
                                                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                                        <span>Fetching job packs...</span>
                                                    </div>
                                                ) : selectedJobPackData ? (
                                                    <div className="flex flex-col items-start gap-0.5 w-full overflow-hidden text-left">
                                                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{selectedJobPackData.jobpack_no}</span>
                                                        <span className="text-[10px] text-slate-500 truncate w-full uppercase tracking-wider font-semibold">
                                                            {selectedJobPackData.jobpack_title} • {selectedJobPackData.structure_name}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm font-medium">
                                                        {!selectedStructure ? "Select structure first..." : jobPacksForSelectedStructure.length === 0 ? "No job packs for structure" : "Choose job pack..."}
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
                                <div className={`space-y-2 transition-opacity duration-305 ${(!selectedStructure || !selectedJobPack) ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
                                    <Label className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                        3. Select Job/SOW Report Number
                                    </Label>

                                    <Popover open={openSOW} onOpenChange={setOpenSOW}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openSOW}
                                                disabled={!selectedStructure || !selectedJobPack || sowReportsLoading || sowReports.length === 0}
                                                className={`w-full justify-between h-11 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 ${selectedSOW ? "border-slate-400 dark:border-slate-600 ring-1 ring-slate-100 dark:ring-slate-800" : ""}`}
                                            >
                                                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                                    {sowReportsLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />}
                                                    <span>
                                                        {selectedSOWData 
                                                            ? selectedSOWData.report_number 
                                                            : (!selectedStructure 
                                                                ? "Select structure first..." 
                                                                : !selectedJobPack 
                                                                    ? "Select job pack first..." 
                                                                    : sowReportsLoading 
                                                                        ? "Fetching SOW reports..." 
                                                                        : sowReports.length === 0 
                                                                            ? "No SOW reports in job pack" 
                                                                            : "Choose SOW report...")}
                                                    </span>
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
                                                router.push(`/dashboard/inspection-v2/workspace?${params.toString()}`);
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
                        {summaryLoading && !sowReportStats ? (
                            <div className="flex flex-col items-center justify-center text-center p-8 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 shadow-md min-h-[300px] space-y-4 transition-all duration-300">
                                <div className="relative flex items-center justify-center">
                                    <div className="p-4 rounded-2xl bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border border-cyan-500/20 shadow-lg shadow-cyan-500/10">
                                        <Hourglass className="h-8 w-8 animate-spin text-cyan-500" style={{ animationDuration: '3s' }} />
                                    </div>
                                    <Loader2 className="h-12 w-12 text-cyan-500 animate-spin absolute opacity-70" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center justify-center gap-2">
                                        Fetching Summary Details...
                                    </h3>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs font-medium">
                                        Calculating inspection progress, anomalies, and feature metrics for <span className="text-cyan-600 dark:text-cyan-400 font-bold">{selectedSOWData?.report_number}</span>.
                                    </p>
                                </div>
                                <div className="pt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3.5 py-1.5 rounded-full border border-slate-200/60 dark:border-slate-800">
                                    <span>Tip: You can click <strong className="text-blue-600 dark:text-blue-400">Start Inspection</strong> to proceed anytime!</span>
                                </div>
                            </div>
                        ) : sowReportStats ? (
                            <div className="relative overflow-hidden p-5 rounded-2xl border border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-950 shadow-md transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                                {/* Dim Loading Overlay */}
                                {summaryLoading && (
                                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/50 backdrop-blur-[2px] rounded-2xl transition-all duration-300">
                                        <div className="p-3.5 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl flex items-center gap-3 text-white">
                                            <Hourglass className="h-6 w-6 text-cyan-400 animate-spin" style={{ animationDuration: '2.5s' }} />
                                            <div className="flex flex-col text-left">
                                                <span className="text-xs font-black tracking-wide text-cyan-400">FETCHING DATA...</span>
                                                <span className="text-[11px] text-slate-300 font-medium">Updating progress summary & anomaly metrics</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Inner Card Content - Dimmed when summaryLoading is true */}
                                <div className={`space-y-4 transition-all duration-300 ${summaryLoading ? "opacity-35 filter blur-[0.5px] pointer-events-none select-none" : "opacity-100"}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">
                                                {selectedStructureData?.type === "pipeline" ? "Pipeline Progress Summary" : "Inspection Progress Summary"}
                                            </h3>
                                            {selectedStructureData?.type === "pipeline" && (
                                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                                                    PIPELINE
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {summaryLoading && (
                                                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold border border-cyan-500/20 animate-pulse">
                                                    <Hourglass className="h-3 w-3 animate-spin text-cyan-500" style={{ animationDuration: '2s' }} />
                                                    <span>Updating...</span>
                                                </div>
                                            )}
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                                {selectedSOWData?.report_number}
                                            </span>
                                        </div>
                                    </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                            {sowReportStats.isPipeline ? "Pipeline Inspection Progress" : "Completion Rate"}
                                        </span>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-xl font-black text-emerald-500">
                                                {sowReportStats.completionPercentage.toFixed(1)}%
                                            </span>
                                            {sowReportStats.isPipeline && sowReportStats.incompletePercentage > 0 && (
                                                <span className="text-xs font-bold text-rose-500">
                                                    ({sowReportStats.incompletePercentage.toFixed(1)}% skipped)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden flex">
                                        <div
                                            className="bg-gradient-to-r from-blue-500 to-emerald-500 h-2.5 transition-all duration-500"
                                            style={{ width: `${sowReportStats.completionPercentage}%` }}
                                            title={`Completed: ${sowReportStats.completionPercentage.toFixed(1)}%`}
                                        />
                                        {sowReportStats.isPipeline && sowReportStats.incompletePercentage > 0 && (
                                            <div
                                                className="bg-rose-500 h-2.5 transition-all duration-500"
                                                style={{ width: `${sowReportStats.incompletePercentage}%` }}
                                                title={`Skipped/Incomplete: ${sowReportStats.incompletePercentage.toFixed(1)}%`}
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    {/* 1. Completed Card */}
                                    <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 shadow-sm flex flex-col justify-between">
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                            <span className="flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                {sowReportStats.isPipeline ? "Inspected Pipeline Length" : "Completed"}
                                            </span>
                                            {sowReportStats.isPipeline && (
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                    {sowReportStats.completionPercentage.toFixed(1)}%
                                                </span>
                                            )}
                                        </span>
                                        <div className="mt-1">
                                            <span className="text-xl font-black text-slate-900 dark:text-white">
                                                {sowReportStats.isPipeline ? `${sowReportStats.inspectedLength.toFixed(3)} km` : sowReportStats.completed}
                                            </span>
                                            {!sowReportStats.isPipeline && (
                                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-600 ml-1">
                                                    / {sowReportStats.total}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[9px] font-semibold text-slate-500 flex flex-col gap-0.5">
                                            {sowReportStats.isPipeline ? (
                                                <div className="flex justify-between">
                                                    <span>Total Length:</span>
                                                    <span className="text-slate-700 dark:text-slate-300 font-bold">{sowReportStats.totalPipelineLength.toFixed(3)} km</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between">
                                                        <span>ROV:</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-bold">{sowReportStats.completedRov}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Diving:</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-bold">{sowReportStats.completedDive}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* 2. Anomalies Card */}
                                    <div className="p-3 rounded-xl bg-slate-55/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 shadow-sm flex flex-col justify-between">
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                                            {selectedStructureData?.type === "pipeline" ? "Pipeline Anomalies" : "Anomalies"}
                                        </span>
                                        <div className="mt-1">
                                            <span className={`text-xl font-black ${anomalyCount > 0 ? "text-amber-500" : "text-slate-900 dark:text-white"}`}>
                                                {anomalyCount}
                                            </span>
                                        </div>
                                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[9px] font-semibold text-slate-500 flex flex-col gap-0.5">
                                            {sowReportStats.isPipeline ? (
                                                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                                                    Pipeline findings & defects
                                                </span>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between">
                                                        <span>ROV:</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-bold">{anomalyStats.rov}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Diving:</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-bold">{anomalyStats.dive}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {selectedStructureData?.type === "pipeline" && (
                                        <div className="col-span-2 p-3 rounded-xl bg-cyan-50/40 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/40 shadow-sm">
                                            <span className="text-[11px] font-bold text-cyan-900 dark:text-cyan-300 flex items-center gap-1 mb-2">
                                                <Activity className="h-3.5 w-3.5 text-cyan-500" />
                                                Pipeline Inspection Features Breakdown
                                            </span>
                                            <div className="grid grid-cols-6 gap-1.5 text-center">
                                                <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-cyan-200/50 dark:border-cyan-800/40">
                                                    <p className="text-[8.5px] text-slate-500 dark:text-slate-400 font-medium truncate">Field Joints</p>
                                                    <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{sowReportStats.fieldJoints}</p>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-cyan-200/50 dark:border-cyan-800/40">
                                                    <p className="text-[8.5px] text-slate-500 dark:text-slate-400 font-medium truncate">Anodes</p>
                                                    <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{sowReportStats.anodes}</p>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-cyan-200/50 dark:border-cyan-800/40">
                                                    <p className="text-[8.5px] text-slate-500 dark:text-slate-400 font-medium truncate">Spans</p>
                                                    <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{sowReportStats.spans}</p>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-cyan-200/50 dark:border-cyan-800/40">
                                                    <p className="text-[8.5px] text-slate-500 dark:text-slate-400 font-medium truncate">Burials</p>
                                                    <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{sowReportStats.burials}</p>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-cyan-200/50 dark:border-cyan-800/40">
                                                    <p className="text-[8.5px] text-slate-500 dark:text-slate-400 font-medium truncate">Crossings</p>
                                                    <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{sowReportStats.crossings}</p>
                                                </div>
                                                <div className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/60 border border-cyan-200/50 dark:border-cyan-800/40">
                                                    <p className="text-[8.5px] text-slate-500 dark:text-slate-400 font-medium truncate">CP Readings</p>
                                                    <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{sowReportStats.cpReadings}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 3. Incomplete Card */}
                                    <div className="p-3 rounded-xl bg-slate-55/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 shadow-sm flex flex-col justify-between">
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                            <span className="flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3 text-rose-500" />
                                                {sowReportStats.isPipeline ? "Skipped Line Length" : "Incomplete"}
                                            </span>
                                            {sowReportStats.isPipeline && (
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                                                    sowReportStats.incompletePercentage > 0
                                                        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                                        : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                                                }`}>
                                                    {sowReportStats.incompletePercentage.toFixed(1)}%
                                                </span>
                                            )}
                                        </span>
                                        <div className="mt-1">
                                            <span className={`text-xl font-black ${(sowReportStats.isPipeline ? sowReportStats.skippedLength > 0 : sowReportStats.incomplete > 0) ? "text-rose-500" : "text-slate-900 dark:text-white"}`}>
                                                {sowReportStats.isPipeline ? `${sowReportStats.skippedLength.toFixed(3)} km` : sowReportStats.incomplete}
                                            </span>
                                        </div>
                                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[9px] font-semibold text-slate-500 flex flex-col gap-0.5">
                                            {sowReportStats.isPipeline ? (
                                                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                                                    Skipped / Incomplete part ({sowReportStats.incompletePercentage.toFixed(1)}% of line)
                                                </span>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between">
                                                        <span>ROV:</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-bold">{sowReportStats.incompleteRov}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Diving:</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-bold">{sowReportStats.incompleteDive}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* 4. Pending Card */}
                                    <div className="p-3 rounded-xl bg-slate-55/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 shadow-sm flex flex-col justify-between">
                                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
                                            <span className="flex items-center gap-1">
                                                <HelpCircle className="h-3 w-3 text-slate-400" />
                                                {sowReportStats.isPipeline ? "Balance to Inspect" : "Pending"}
                                            </span>
                                            {sowReportStats.isPipeline && (
                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                                    {sowReportStats.pendingPercentage.toFixed(1)}%
                                                </span>
                                            )}
                                        </span>
                                        <div className="mt-1">
                                            <span className="text-xl font-black text-slate-900 dark:text-white">
                                                {sowReportStats.isPipeline ? `${sowReportStats.pendingLength.toFixed(3)} km` : sowReportStats.pending}
                                            </span>
                                        </div>
                                        <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[9px] font-semibold text-slate-500 flex flex-col gap-0.5">
                                            {sowReportStats.isPipeline ? (
                                                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                                                    Pending length to inspect ({sowReportStats.pendingPercentage.toFixed(1)}% remaining)
                                                </span>
                                            ) : (
                                                <>
                                                    <div className="flex justify-between">
                                                        <span>ROV:</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-bold">{sowReportStats.pendingRov}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span>Diving:</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-bold">{sowReportStats.pendingDive}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
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
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 transition-all duration-300 ${summaryLoading ? "opacity-50 filter blur-[0.3px]" : "opacity-100"}`}>
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
