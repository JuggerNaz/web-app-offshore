"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    ChevronRight, 
    Save, 
    FileText, 
    Printer, 
    Download, 
    RefreshCw, 
    Database, 
    LayoutList,
    Search,
    CheckCircle2,
    Circle,
    Copy,
    Info,
    PanelRightOpen,
    ArrowRight,
    Settings,
    FileCheck,
    BookOpen,
    BarChart3
} from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { EXECUTIVE_SUMMARY_TOC, isItemMatchingSection } from "./constants";
import { SearchableSelect } from "./SearchableSelect";
// Heavy dialogs are lazy-loaded client-side; Radix Dialog renders nothing while
// closed, so their chunks still background-preload on mount without blocking first paint.
const ReportSettingsDialog = dynamic(
    () => import("./ReportSettingsDialog").then((m) => m.ReportSettingsDialog),
    { ssr: false }
);
const SummaryTemplatesDialog = dynamic(
    () => import("./SummaryTemplatesDialog").then((m) => m.SummaryTemplatesDialog),
    { ssr: false }
);
const InspectionAnalyticsDialog = dynamic(
    () => import("./InspectionAnalyticsDialog").then((m) => m.InspectionAnalyticsDialog),
    { ssr: false }
);

export default function ExecutiveSummaryPage() {
    const [selections, setSelections] = useState({
        jobpackId: "",
        structureId: "",
        sowReportNo: ""
    });

    // Safe load on mount
    useEffect(() => {
        const saved = localStorage.getItem("executive_summary_selections");
        if (saved) {
            try {
                setSelections(JSON.parse(saved));
            } catch (e) {}
        }
    }, []);

    // Safe save on selections change
    useEffect(() => {
        localStorage.setItem("executive_summary_selections", JSON.stringify(selections));
    }, [selections]);

    const [activeSectionId, setActiveSectionId] = useState("intro");
    const [sectionsData, setSectionsData] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [showInsight, setShowInsight] = useState(false);
    const [reportType, setReportType] = useState("final");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

    // Fetch context data
    const { data: allJobpacksRes } = useSWR("/api/jobpack?limit=1000", fetcher);
    // Fallback fetch fires only after the primary list has resolved empty,
    // instead of doubling the /api/jobpack load on every mount.
    const allJobpackList = allJobpacksRes?.data;
    const { data: inspJobpacksRes } = useSWR(
        allJobpacksRes !== undefined && (!allJobpackList || allJobpackList.length === 0)
            ? "/api/jobpack?limit=1000&has_inspection=true"
            : null,
        fetcher
    );
    const { data: companySettings } = useSWR("/api/company-settings", fetcher);
    const { data: templatesRes } = useSWR("/api/report-templates", fetcher);
    const { data: structuresRes } = useSWR("/api/structures", fetcher);
    const { data: contractorsRes } = useSWR("/api/jobpack/utils/contractors", fetcher);
    const contractors = useMemo(() => contractorsRes?.data || [], [contractorsRes]);

    const jobpacks = useMemo(() => {
        const list = (allJobpacksRes?.data && allJobpacksRes.data.length > 0)
            ? allJobpacksRes.data
            : (inspJobpacksRes?.data || []);
        return [...list].sort((a, b) => 
            (a.name || "").localeCompare(b.name || "", undefined, { numeric: true })
        );
    }, [allJobpacksRes, inspJobpacksRes]);

    const structures = useMemo(() => {
        return [...(structuresRes?.data || [])].sort((a, b) => 
            (a.str_name || "").localeCompare(b.str_name || "", undefined, { numeric: true })
        );
    }, [structuresRes]);

    const cleanStructureId = useMemo(() => {
        if (!selections.structureId) return "";
        return selections.structureId.replace(/^(platform|pipeline)-/, "");
    }, [selections.structureId]);

    // Fetch distinct inspection records combinations (jobpack_id, structure_id, sow_report_no)
    const { data: structureInspectionFiltersRes } = useSWR(
        cleanStructureId ? `/api/reports/inspection-filters?structure_id=${cleanStructureId}` : null,
        fetcher
    );

    const { data: sowsForStructureData } = useSWR(
        cleanStructureId ? `/api/sow?structure_id=${cleanStructureId}` : null,
        fetcher
    );

    const checkJobPackMatchesStructure = (jp: any, structureIdStr: string) => {
        if (!jp || !structureIdStr) return false;
        const selStructId = structureIdStr.replace(/^(platform|pipeline)-/, "");
        const structObj = structures.find((s: any) => s.id?.toString() === selStructId);
        const selStructName = structObj?.str_name?.toLowerCase().trim();

        // 1. Direct structure columns on jobpack
        if (jp.structure_id !== undefined && jp.structure_id !== null && jp.structure_id.toString() === selStructId) return true;
        if (Array.isArray(jp.structure_ids) && jp.structure_ids.some((id: any) => id?.toString() === selStructId)) return true;

        const meta = jp.metadata || {};

        // 2. Direct structure IDs in metadata
        if (meta.structure_id !== undefined && meta.structure_id !== null && meta.structure_id.toString() === selStructId) return true;
        if (meta.platform_id !== undefined && meta.platform_id !== null && meta.platform_id.toString() === selStructId) return true;
        if (Array.isArray(meta.structure_ids) && meta.structure_ids.some((id: any) => id?.toString() === selStructId)) return true;

        // 3. Structures list in metadata (structures or structure_list)
        const structuresList = Array.isArray(meta.structures) 
            ? meta.structures 
            : Array.isArray(meta.structure_list) 
            ? meta.structure_list 
            : meta.structures 
            ? [meta.structures] 
            : [];

        if (structuresList.length > 0) {
            for (const s of structuresList) {
                if (!s) continue;
                if (typeof s === 'string' || typeof s === 'number') {
                    if (s.toString() === selStructId) return true;
                    if (selStructName && s.toString().toLowerCase().trim() === selStructName) return true;
                } else if (typeof s === 'object') {
                    const sid = s.id ?? s.str_id ?? s.structure_id ?? s.plat_id;
                    if (sid !== undefined && sid !== null && sid.toString() === selStructId) return true;
                    const sName = s.name ?? s.title ?? s.str_name ?? s.platform_name;
                    if (selStructName && sName && sName.toString().toLowerCase().trim() === selStructName) return true;
                }
            }
        }

        // 4. Platform / Structure name in metadata strings
        const metaPlatform = meta.platform || meta.platform_name || meta.structure_name || meta.platformName;
        if (selStructName && metaPlatform && metaPlatform.toString().toLowerCase().trim() === selStructName) return true;

        // 5. Check if jobpack name mentions the structure
        if (selStructName && jp.name && jp.name.toLowerCase().includes(selStructName)) return true;

        return false;
    };

    const filteredJobpacks = useMemo(() => {
        if (!selections.structureId) return jobpacks;
        
        const inspectedJpIds = new Set(
            (structureInspectionFiltersRes?.data || []).map((f: any) => f.jobpack_id?.toString()).filter(Boolean)
        );
        const sowJpIds = new Set(
            (Array.isArray(sowsForStructureData?.data) ? sowsForStructureData.data : [])
                .map((s: any) => s.jobpack_id?.toString())
                .filter(Boolean)
        );
        
        const matches = jobpacks.filter((jp: any) => {
            const idStr = jp.id?.toString();
            if (inspectedJpIds.has(idStr)) return true;
            if (sowJpIds.has(idStr)) return true;
            return checkJobPackMatchesStructure(jp, selections.structureId);
        });

        // Fallback to all jobpacks if nothing matched so user isn't locked out
        return matches.length > 0 ? matches : jobpacks;
    }, [selections.structureId, jobpacks, structureInspectionFiltersRes, sowsForStructureData, structures]);

    // Fetch SOW and inspection filters for the selected Jobpack and Structure
    const { data: jobpackInspFiltersRes } = useSWR(
        selections.jobpackId && cleanStructureId
            ? `/api/reports/inspection-filters?jobpack_id=${selections.jobpackId}&structure_id=${cleanStructureId}`
            : null,
        fetcher
    );

    const { data: sowsData } = useSWR(
        selections.jobpackId && cleanStructureId 
            ? `/api/sow?jobpack_id=${selections.jobpackId}&structure_id=${cleanStructureId}` 
            : null, 
        fetcher
    );

    const availableSowReports = useMemo(() => {
        const reportsSet = new Set<string>();

        // 1. From SOW data report_numbers
        if (sowsData?.data && typeof sowsData.data === 'object') {
            const reportNumbers = sowsData.data.report_numbers;
            if (Array.isArray(reportNumbers)) {
                reportNumbers.forEach((r: any) => {
                    const val = r?.number || r;
                    if (val && typeof val === 'string' && val.trim()) {
                        reportsSet.add(val.trim());
                    }
                });
            }
        }

        // 2. From inspection filters (distinct sow_report_no in insp_records)
        if (jobpackInspFiltersRes?.data && Array.isArray(jobpackInspFiltersRes.data)) {
            jobpackInspFiltersRes.data.forEach((f: any) => {
                if (f.sow_report_no && typeof f.sow_report_no === 'string' && f.sow_report_no.trim()) {
                    reportsSet.add(f.sow_report_no.trim());
                }
            });
        }

        // 3. From structure-level inspection filters if matches jobpack
        if (structureInspectionFiltersRes?.data && Array.isArray(structureInspectionFiltersRes.data)) {
            structureInspectionFiltersRes.data.forEach((f: any) => {
                if (f.jobpack_id?.toString() === selections.jobpackId && f.sow_report_no?.trim()) {
                    reportsSet.add(f.sow_report_no.trim());
                }
            });
        }

        return Array.from(reportsSet).sort((a, b) => 
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );
    }, [sowsData, jobpackInspFiltersRes, structureInspectionFiltersRes, selections.jobpackId]);

    // Fetch existing summary
    const { data: summaryData, mutate: refreshSummary } = useSWR(
        selections.jobpackId && cleanStructureId && selections.sowReportNo
            ? `/api/executive-summary?jobpack_id=${selections.jobpackId}&structure_id=${cleanStructureId}&sow_report_no=${selections.sowReportNo}`
            : null,
        fetcher
    );

    // Fetch insight data (Live stats)
    const { data: insightData, isLoading: isLoadingInsight } = useSWR(
        selections.jobpackId && cleanStructureId && selections.sowReportNo
            ? `/api/inspection-summary?jobpack_id=${selections.jobpackId}&structure_id=${cleanStructureId}&sow_report_no=${selections.sowReportNo}`
            : null,
        fetcher
    );

    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

    // Fetch templates for the active section to evaluate conditional rules
    const { data: sectionTemplatesRes, mutate: refreshSectionTemplates } = useSWR(
        selections.sowReportNo
            ? `/api/executive-summary/templates?section_id=${activeSectionId}`
            : null,
        fetcher
    );
    const sectionTemplates = sectionTemplatesRes?.data || [];
    const conditionalTemplate = sectionTemplates.find((t: any) => t.metadata?.template_type === "conditional");
    const existingRules = conditionalTemplate?.metadata || null;

    const customVariables = summaryData?.data?.metadata?.custom_variables || {};

    const handleSaveRules = async (rules: any) => {
        const res = await fetch("/api/executive-summary/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                template_name: `Conditional Rules - ${activeSectionId}`,
                section_id: activeSectionId,
                content: "[Conditional Rules]",
                client_name: companySettings?.data?.company_name || "",
                metadata: {
                    template_type: "conditional",
                    ...rules
                }
            })
        });
        if (!res.ok) throw new Error("Failed to save conditional rules");
        refreshSectionTemplates();
    };

    const handleSaveCustomVariables = async (vars: Record<string, string>) => {
        if (!selections.jobpackId || !cleanStructureId || !selections.sowReportNo) return;
        
        const sections = EXECUTIVE_SUMMARY_TOC.map(s => ({
            id: s.id,
            title: s.title,
            content: sectionsData[s.id] || ""
        }));
        
        const updatedMetadata = {
            ...(summaryData?.data?.metadata || {}),
            custom_variables: vars
        };
        
        const res = await fetch("/api/executive-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jobpack_id: Number(selections.jobpackId),
                structure_id: Number(cleanStructureId),
                sow_report_no: selections.sowReportNo,
                sections,
                metadata: updatedMetadata
            })
        });
        
        if (!res.ok) throw new Error("Failed to save custom variables");
        refreshSummary();
    };

    useEffect(() => {
        if (summaryData?.data?.sections) {
            const data: Record<string, string> = {};
            summaryData.data.sections.forEach((s: any) => {
                data[s.id] = s.content;
            });
            setSectionsData(data);
        } else {
            setSectionsData({});
        }
    }, [summaryData]);

    const activeSection = useMemo(() => 
        EXECUTIVE_SUMMARY_TOC.find(s => s.id === activeSectionId), 
    [activeSectionId]);

    const handleSave = async () => {
        if (!selections.jobpackId || !cleanStructureId || !selections.sowReportNo) return;
        
        setIsSaving(true);
        try {
            const sections = EXECUTIVE_SUMMARY_TOC.map(s => ({
                id: s.id,
                title: s.title,
                content: sectionsData[s.id] || ""
            }));

            const res = await fetch("/api/executive-summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jobpack_id: Number(selections.jobpackId),
                    structure_id: Number(cleanStructureId),
                    sow_report_no: selections.sowReportNo,
                    sections,
                    metadata: { last_saved_at: new Date().toISOString() }
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to save");
            }

            toast.success("Executive Summary saved successfully");
            refreshSummary();
        } catch (error: any) {
            console.error("Save error:", error);
            toast.error(error.message || "Error saving summary");
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportDocx = async () => {
        if (!selections.jobpackId || !selections.structureId || !selections.sowReportNo) return;
        
        const jp = jobpacks.find((j:any) => j.id.toString() === selections.jobpackId);
        const str = structures.find((s:any) => s.id.toString() === selections.structureId);
        
        // Find default template for selected type
        const allTemplates = templatesRes?.data || [];
        const templates = allTemplates.filter((t: any) => t.type === reportType);
        const template = templates.find((t: any) => t.is_default) || templates[0];

        if (!template) {
            toast.error(`No ${reportType} template found. Please upload one in settings.`);
            setIsSettingsOpen(true);
            return;
        }

        setIsGenerating(true);
        try {
            const { mapInspectionDataForDocx, generateMgiProfileImage, generateSeabedMapImage } = await import("@/utils/report-generators/report-data-mapper");
            
            const sections = EXECUTIVE_SUMMARY_TOC.map((s, idx) => {
                const sectionData: any = {
                    id: s.id,
                    title: s.title,
                    content: sectionsData[s.id] || "",
                    no: idx + 1,
                    paragraph_no: `1.${idx + 1}`
                };
                
                // Create a boolean flag like 'is_seabed' or 'is_marine_growth'
                sectionData[`is_${s.id}`] = true;
                
                return sectionData;
            });

            // Fetch Aliases
            const aliasesRes = await fetch("/api/report-aliases");
            let aliases: any[] = [];
            if (aliasesRes.ok) {
                const aliasesData = await aliasesRes.json();
                aliases = Array.isArray(aliasesData?.data) ? aliasesData.data : [];
            }

            // Fetch Contractors
            const contractorsRes = await fetch("/api/jobpack/utils/contractors");
            let contractors: any[] = [];
            if (contractorsRes.ok) {
                const contrData = await contractorsRes.json();
                contractors = Array.isArray(contrData?.data) ? contrData.data : [];
            }
            const activeContractor = contractors.find((c: any) => String(c.lib_id) === String(jp?.metadata?.contrac));

            // Fetch Detailed Records
            const recordsRes = await fetch(`/api/inspection-records?jobpack_id=${selections.jobpackId}&structure_id=${cleanStructureId || selections.structureId}&sow_report_no=${selections.sowReportNo}`);
            if (!recordsRes.ok) {
                const errText = await recordsRes.text();
                throw new Error(`Failed to fetch inspection records: ${recordsRes.status} ${recordsRes.statusText}`);
            }
            const recordsData = await recordsRes.json();
            const allRecords = Array.isArray(recordsData?.data) ? recordsData.data : [];

            // Map data for DOCX
            const mappedData = await mapInspectionDataForDocx(
                allRecords,
                aliases,
                jp,
                str,
                selections.sowReportNo,
                companySettings?.data
            );

            // Generate MGI Graph if applicable
            const mgiRecords = allRecords.filter((r: any) => 
                (r.inspection_type?.code || "").toUpperCase() === "RMGI" || 
                (r.inspection_type?.code || "").toUpperCase() === "MGROW"
            );
            if (mgiRecords.length > 0) {
                const mgiGraph = await generateMgiProfileImage(mgiRecords);
                if (mgiGraph) {
                    mappedData.MGI_GRAPH = {
                        data: mgiGraph,
                        extension: '.png'
                    };
                }
            }

            // Generate Seabed Map Graph if applicable
            const seabedRecords = allRecords.filter((r: any) => 
                (r.inspection_type?.code || "").toUpperCase() === "RSEAB"
            );
            if (seabedRecords.length > 0) {
                const seabedGraph = await generateSeabedMapImage(seabedRecords);
                if (seabedGraph) {
                    mappedData.SEABED_GRAPH = {
                        data: seabedGraph,
                        extension: '.png'
                    };
                }
            }

            // Fetch Structure Visuals (Visual Documentation from Engineering Library)
            let structureVisuals: any[] = [];
            try {
                const structType = (str?.str_type || "PLATFORM").toLowerCase();
                const sourceType = `${structType}_structure_image`;
                const apiRes = await fetch(`/api/attachment/${sourceType}/${cleanStructureId || selections.structureId}`);
                if (apiRes.ok) {
                    const apiJson = await apiRes.json();
                    const visualAtts = apiJson.data;

                    if (visualAtts && Array.isArray(visualAtts)) {
                        const { createClient } = await import("@/utils/supabase/client");
                        const supabase = createClient();

                        structureVisuals = await Promise.all(visualAtts.map(async (att: any) => {
                            const title = att.meta?.title || att.name || "Visual Documentation";
                            const description = att.meta?.description || att.description || "";

                            let imgData: any = null;
                            try {
                                const { data: blob, error: downloadError } = await supabase.storage
                                    .from("attachments")
                                    .download(att.path);

                                if (blob && !downloadError) {
                                    const arrayBuffer = await blob.arrayBuffer();
                                    imgData = new Uint8Array(arrayBuffer);
                                } else if (downloadError) {
                                    console.error("Error downloading visual attachment:", downloadError);
                                }
                            } catch (downloadErr) {
                                console.error("Failed to download attachment from storage:", downloadErr);
                            }

                            if (!imgData) {
                                imgData = `/api/attachment/url?id=${att.id}`;
                            }

                            const fileExt = att.meta?.file_type?.split('/')[1] ? `.${att.meta.file_type.split('/')[1]}` : '.jpg';

                            return {
                                title,
                                description,
                                photo: { data: imgData, extension: fileExt }
                            };
                        }));
                    }
                }
            } catch (e) {
                console.error("Error fetching structure visuals for docx:", e);
            }

            let rawAnomalies = insightData?.data?.anomalies?.items || [];
            const getFilteredAnomalies = (filterFn: (item: any) => boolean) => {
                return rawAnomalies
                    .filter(filterFn)
                    .map((item: any, idx: number) => ({
                        ...item,
                        id: idx + 1,
                        no: idx + 1
                    }));
            };

            // Fetch Priority Colors from AMLYCLR combo
            const priorityColors: Record<string, string> = {
                "P1": "255,0,0",
                "P2": "255,255,0",
                "P3": "0,255,0",
                "OBSERVATION": "255,165,0"
            };

            try {
                const colorsRes = await fetch("/api/library/combo/ANMLYCLR");
                if (colorsRes.ok) {
                    const colorsJson = await colorsRes.json();
                    const items = Array.isArray(colorsJson?.data) ? colorsJson.data : [];
                    items.forEach((item: any) => {
                        if (item.lib_delete !== 1 && item.lib_delete !== true) {
                            const code1 = String(item.code_1 || "").trim().toUpperCase();
                            const colorVal = String(item.code_2 || "").trim();
                            if (code1 && colorVal) {
                                priorityColors[code1] = colorVal;
                            }
                        }
                    });
                }
            } catch (err) {
                console.error("Failed to fetch AMLYCLR colors:", err);
            }

            const rgbToHex = (rgbStr: string): string => {
                const clean = rgbStr.trim().toUpperCase();
                if (clean === "RED" || clean === "FF0000") return "FF0000";
                if (clean === "YELLOW" || clean === "FFFF00") return "FFFF00";
                if (clean === "GREEN" || clean === "00FF00") return "00FF00";
                if (clean === "ORANGE" || clean === "FFA500") return "FFA500";
                if (clean === "BLUE" || clean === "0000FF") return "0000FF";
                
                const parts = clean.split(',').map(x => parseInt(x.trim()));
                if (parts.length === 3 && parts.every(x => !isNaN(x))) {
                    return parts.map(x => {
                        const hex = x.toString(16).toUpperCase();
                        return hex.length === 1 ? '0' + hex : hex;
                    }).join('');
                }
                return "FFFFFF";
            };

            const obsColorRgb = priorityColors["OBSERVATION"] || "255,165,0";
            const p1ColorRgb = priorityColors["P1"] || "255,0,0";
            const p2ColorRgb = priorityColors["P2"] || "255,255,0";
            const p3ColorRgb = priorityColors["P3"] || "0,255,0";

            const obsColorHex = rgbToHex(obsColorRgb);
            const p1ColorHex = rgbToHex(p1ColorRgb);
            const p2ColorHex = rgbToHex(p2ColorRgb);
            const p3ColorHex = rgbToHex(p3ColorRgb);

            const getPriorityFilter = (prioName: string) => {
                const upper = prioName.toUpperCase();
                return (x: any) => {
                    const itemPrio = String(x.priority || "").trim().toUpperCase();
                    return itemPrio === upper || 
                           itemPrio === `PRIORITY ${upper}` || 
                           itemPrio === `PRIORITY_${upper}` ||
                           (upper === "P1" && itemPrio === "PRIORITY 1") ||
                           (upper === "P2" && itemPrio === "PRIORITY 2") ||
                           (upper === "P3" && itemPrio === "PRIORITY 3") ||
                           (upper === "OBS" && (itemPrio === "OBSERVATION" || itemPrio === "OBS"));
                };
            };
            const getPriorityKey = (prioStr: string) => {
                const clean = String(prioStr || "").trim().toUpperCase();
                if (clean === "P1" || clean === "PRIORITY 1") return "P1";
                if (clean === "P2" || clean === "PRIORITY 2") return "P2";
                if (clean === "P3" || clean === "PRIORITY 3") return "P3";
                if (clean === "OBS" || clean === "OBSERVATION" || clean === "O") return "OBSERVATION";
                return null;
            };

            rawAnomalies = rawAnomalies.map((item: any) => {
                const key = getPriorityKey(item.priority || item.priority_code);
                let hex = "FFFFFF";
                let rgb = "255,255,255";
                
                if (key === "P1") { hex = p1ColorHex; rgb = p1ColorRgb; }
                else if (key === "P2") { hex = p2ColorHex; rgb = p2ColorRgb; }
                else if (key === "P3") { hex = p3ColorHex; rgb = p3ColorRgb; }
                else if (key === "OBSERVATION") { hex = obsColorHex; rgb = obsColorRgb; }

                const defectDesc = item.defect_description || item.defectDescription || item.defect_desc || item.description || item.findings || item.comments || "-";
                const inspDesc = item.inspection_description || item.inspectionDescription || item.inspection_data?.findings || item.findings || item.description || item.comments || "-";
                const isRect = item.is_rectified === true || item.is_rectified === 1 || String(item.status || "").toLowerCase() === "rectified" || item.rectified === true || item.rectified === 1;
                const rectRemarks = item.rectified_remarks || item.rectification_remarks || item.rectified_action || item.remedial_action || item.action_taken || item.rectified_comments || (isRect ? (item.remarks || item.comments || "Rectified during campaign") : "-");
                const rectDate = item.rectification_date || item.rectified_date || item.rect_date || (isRect ? (item.date || "-") : "-");

                return {
                    ...item,
                    defect_description: defectDesc,
                    inspection_description: inspDesc,
                    description: defectDesc,
                    is_rectified: isRect,
                    rectified: isRect ? "Yes" : "No",
                    rectified_status: isRect ? "Rectified" : "Not Rectified",
                    rectified_remarks: rectRemarks,
                    rectification_remarks: rectRemarks,
                    rectified_action: rectRemarks,
                    remedial_action: rectRemarks,
                    rectification_date: rectDate,
                    rectified_date: rectDate,
                    color_hex: hex,
                    color_rgb: rgb,
                    color_xml: `<w:tcPr><w:shd w:fill="${hex}"/></w:tcPr>`
                };
            });
            const p1Anoms = rawAnomalies.filter(getPriorityFilter("P1"));
            const p2Anoms = rawAnomalies.filter(getPriorityFilter("P2"));
            const p3Anoms = rawAnomalies.filter(getPriorityFilter("P3"));
            const obsAnoms = rawAnomalies.filter(getPriorityFilter("OBS"));

            const getRectifiedCount = (items: any[]) => items.filter((x: any) => x.is_rectified === true || x.is_rectified === 1 || String(x.status || "").toLowerCase() === "rectified" || (x.rectified === true || x.rectified === 1)).length;

            const categoryStats = [
                {
                    name: "Observation",
                    not_rectified: obsAnoms.length - getRectifiedCount(obsAnoms),
                    rectified: getRectifiedCount(obsAnoms),
                    total: obsAnoms.length,
                    color_hex: obsColorHex,
                    color_rgb: obsColorRgb,
                    color_xml: `<w:tcPr><w:shd w:fill="${obsColorHex}"/></w:tcPr>`
                },
                {
                    name: "Priority 1",
                    not_rectified: p1Anoms.length - getRectifiedCount(p1Anoms),
                    rectified: getRectifiedCount(p1Anoms),
                    total: p1Anoms.length,
                    color_hex: p1ColorHex,
                    color_rgb: p1ColorRgb,
                    color_xml: `<w:tcPr><w:shd w:fill="${p1ColorHex}"/></w:tcPr>`
                },
                {
                    name: "Priority 2",
                    not_rectified: p2Anoms.length - getRectifiedCount(p2Anoms),
                    rectified: getRectifiedCount(p2Anoms),
                    total: p2Anoms.length,
                    color_hex: p2ColorHex,
                    color_rgb: p2ColorRgb,
                    color_xml: `<w:tcPr><w:shd w:fill="${p2ColorHex}"/></w:tcPr>`
                },
                {
                    name: "Priority 3",
                    not_rectified: p3Anoms.length - getRectifiedCount(p3Anoms),
                    rectified: getRectifiedCount(p3Anoms),
                    total: p3Anoms.length,
                    color_hex: p3ColorHex,
                    color_rgb: p3ColorRgb,
                    color_xml: `<w:tcPr><w:shd w:fill="${p3ColorHex}"/></w:tcPr>`
                }
            ];

            const totalNotRectified = categoryStats.reduce((sum, item) => sum + item.not_rectified, 0);
            const totalRectified = categoryStats.reduce((sum, item) => sum + item.rectified, 0);
            const totalAnomCount = categoryStats.reduce((sum, item) => sum + item.total, 0);

            // ── Findings Summary Table Data ─────────────────────
            let rawFindings = insightData?.data?.findings?.items || [];
            rawFindings = rawFindings.map((item: any, idx: number) => {
                const key = getPriorityKey(item.priority || item.priority_code);
                let hex = "FFFFFF";
                let rgb = "255,255,255";
                
                if (key === "P1") { hex = p1ColorHex; rgb = p1ColorRgb; }
                else if (key === "P2") { hex = p2ColorHex; rgb = p2ColorRgb; }
                else if (key === "P3") { hex = p3ColorHex; rgb = p3ColorRgb; }
                else if (key === "OBSERVATION") { hex = obsColorHex; rgb = obsColorRgb; }

                const defectDesc = item.defect_description || item.defectDescription || item.findings || item.description || item.comments || "-";
                const inspDesc = item.inspection_description || item.inspectionDescription || item.findings || item.description || item.comments || "-";
                const isRect = item.is_rectified === true || item.is_rectified === 1 || String(item.status || "").toLowerCase() === "rectified" || item.rectified === true || item.rectified === 1;
                const rectRemarks = item.rectified_remarks || item.rectification_remarks || item.rectified_action || item.remedial_action || item.action_taken || item.rectified_comments || (isRect ? (item.remarks || item.comments || "Rectified during campaign") : "-");
                const rectDate = item.rectification_date || item.rectified_date || item.rect_date || (isRect ? (item.date || "-") : "-");

                return {
                    ...item,
                    id: idx + 1,
                    no: idx + 1,
                    defect_description: defectDesc,
                    inspection_description: inspDesc,
                    findings: inspDesc,
                    description: defectDesc,
                    is_rectified: isRect,
                    rectified: isRect ? "Yes" : "No",
                    rectified_status: isRect ? "Rectified" : "Not Rectified",
                    rectified_remarks: rectRemarks,
                    rectification_remarks: rectRemarks,
                    rectified_action: rectRemarks,
                    remedial_action: rectRemarks,
                    rectification_date: rectDate,
                    rectified_date: rectDate,
                    color_hex: hex,
                    color_rgb: rgb,
                    color_xml: `<w:tcPr><w:shd w:fill="${hex}"/></w:tcPr>`
                };
            });

            const obsFindings = rawFindings.filter(getPriorityFilter("OBS"));
            const p1Findings = rawFindings.filter(getPriorityFilter("P1"));
            const p2Findings = rawFindings.filter(getPriorityFilter("P2"));
            const p3Findings = rawFindings.filter(getPriorityFilter("P3"));

            const incompleteRecords = allRecords
                .filter((r: any) => {
                    const st = String(r.status || r.inspection_data?.status || "").toUpperCase();
                    const ft = String(r.finding_type || r.inspection_data?.finding_type || "").toUpperCase();
                    return st === "INCOMPLETE" || ft === "INCOMPLETE" || Boolean(r.incomplete_reason || r.inspection_data?.incomplete_reason);
                })
                .map((r: any, idx: number) => {
                    const reason = r.incomplete_reason || r.incompleteReason || r.inspection_data?.incomplete_reason || r.reason || "Weather / Operational Constraints";
                    const remarks = r.remarks || r.inspection_data?.remarks || r.comments || r.inspection_data?.comments || "-";
                    const qid = r.structure_components?.q_id || r.inspection_data?.q_id || r.qid || "N/A";
                    const elv = r.elevation || r.inspection_data?.elevation || "-";
                    const inspType = r.inspection_type?.name || r.inspection_type_code || r.inspection_type?.code || "N/A";
                    const compType = r.structure_components?.component_type || r.component_type || "N/A";
                    const taskName = r.task_name || `${inspType} - ${qid}`;
                    const actionPlan = r.action_plan || r.remedial_action || "To be deferred to next campaign";
                    return {
                        ...r,
                        no: idx + 1,
                        id: idx + 1,
                        qid,
                        elevation: elv,
                        component_type: compType,
                        inspection_type: inspType,
                        task_name: taskName,
                        status: "INCOMPLETE",
                        reason,
                        incomplete_reason: reason,
                        remarks,
                        action_plan: actionPlan,
                        dive_no: r.dive_no || r.inspection_data?.dive_no || "-"
                    };
                });

            const findingsCategoryStats = [
                {
                    name: "Observation",
                    not_rectified: obsFindings.length - getRectifiedCount(obsFindings),
                    rectified: getRectifiedCount(obsFindings),
                    total: obsFindings.length,
                    color_hex: obsColorHex,
                    color_rgb: obsColorRgb,
                    color_xml: `<w:tcPr><w:shd w:fill="${obsColorHex}"/></w:tcPr>`
                },
                {
                    name: "Priority 1",
                    not_rectified: p1Findings.length - getRectifiedCount(p1Findings),
                    rectified: getRectifiedCount(p1Findings),
                    total: p1Findings.length,
                    color_hex: p1ColorHex,
                    color_rgb: p1ColorRgb,
                    color_xml: `<w:tcPr><w:shd w:fill="${p1ColorHex}"/></w:tcPr>`
                },
                {
                    name: "Priority 2",
                    not_rectified: p2Findings.length - getRectifiedCount(p2Findings),
                    rectified: getRectifiedCount(p2Findings),
                    total: p2Findings.length,
                    color_hex: p2ColorHex,
                    color_rgb: p2ColorRgb,
                    color_xml: `<w:tcPr><w:shd w:fill="${p2ColorHex}"/></w:tcPr>`
                },
                {
                    name: "Priority 3",
                    not_rectified: p3Findings.length - getRectifiedCount(p3Findings),
                    rectified: getRectifiedCount(p3Findings),
                    total: p3Findings.length,
                    color_hex: p3ColorHex,
                    color_rgb: p3ColorRgb,
                    color_xml: `<w:tcPr><w:shd w:fill="${p3ColorHex}"/></w:tcPr>`
                }
            ];

            const totalFindingsNotRectified = findingsCategoryStats.reduce((sum, item) => sum + item.not_rectified, 0);
            const totalFindingsRectified = findingsCategoryStats.reduce((sum, item) => sum + item.rectified, 0);
            const totalFindingsCount = findingsCategoryStats.reduce((sum, item) => sum + item.total, 0);

            const outstandingRawList = insightData?.data?.outstanding_tasks || [];

            // Sections (User-Written) with section-specific filtered lists and global tables
            // Helper functions for ROV/Diving and Above/Underwater filtering
            const isROV = (item: any) => {
                if (item.rov_job_id) return true;
                const code = String(item.inspection_type_code || item.inspectionType || item.inspection_data?.insp_type || "").toUpperCase();
                if (code === "NAVIG" || code === "ROVCLB" || (code.startsWith("R") && code !== "RISER" && code !== "RB")) return true;
                const diveNo = String(item.inspection_data?.dive_no || item.inspection_data?.DIVE_NO || item.dive_no || "").toUpperCase();
                if (diveNo.startsWith("R")) return true;
                return false;
            };
            const isDiving = (item: any) => !isROV(item);
            const isAboveWater = (item: any) => {
                const elvStr = String(item.elevation || item.inspection_data?.elevation || item.elev || "").trim();
                if (elvStr) {
                    if (elvStr.includes("(+)") || elvStr.startsWith("+")) return true;
                    if (elvStr.includes("(-)") || elvStr.startsWith("-")) return false;
                    const elv = parseFloat(elvStr.replace(/[^0-9.-]/g, ""));
                    if (!isNaN(elv) && elv > 0) return true;
                    if (!isNaN(elv) && elv < 0) return false;
                }
                const desc = String(item.description || item.component_type || item.componentType || item.inspection_type_name || item.qid || "").toUpperCase();
                if (desc.includes("TOPSIDE") || desc.includes("ABOVE") || desc.includes("ATMOSPHERIC")) return true;
                if (desc.includes("SUBSEA") || desc.includes("UNDERWATER") || desc.includes("DIVE") || desc.includes("ROV")) return false;
                return false;
            };
            const isUnderwater = (item: any) => !isAboveWater(item);

            const getSubRecords = (secId: string, filterFn?: (r: any) => boolean) => {
                return allRecords
                    .filter((r: any) => isItemMatchingSection(r, secId))
                    .filter(filterFn || (() => true))
                    .map((r: any, i: number) => ({
                        ...r,
                        no: i + 1,
                        id: i + 1,
                        qid: r.structure_components?.q_id || r.inspection_data?.q_id || r.qid || "N/A",
                        elevation: r.elevation || r.inspection_data?.elevation || "-",
                        description: r.description || r.inspection_data?.findings || r.inspection_data?.comments || "-"
                    }));
            };

            const getSubAnomalies = (secId: string, filterFn?: (a: any) => boolean) => {
                return rawAnomalies
                    .filter((a: any) => isItemMatchingSection(a, secId))
                    .filter(filterFn || (() => true))
                    .map((a: any, i: number) => {
                        const defectDesc = a.defect_description || a.defectDescription || a.defect_desc || a.description || a.comments || "-";
                        const inspDesc = a.inspection_description || a.inspectionDescription || a.findings || a.description || "-";
                        const refVal = a.ref || a.ref_no || a.anom_no || a.defect_ref_no || a.id || "-";
                        const defCode = a.defect_code || a.defectCode || a.defect || a.defect_type || "-";
                        const qidVal = a.qid || a.structure_components?.q_id || a.component_code || a.component_id || "N/A";
                        const elvVal = a.elevation || a.elev || a.inspection_data?.elevation || "-";

                        return {
                            ...a,
                            no: i + 1,
                            id: i + 1,
                            qid: qidVal,
                            elevation: elvVal,
                            elev: elvVal,
                            defect_code: defCode,
                            defect: defCode,
                            ref: refVal,
                            ref_no: refVal,
                            anom_no: refVal,
                            findings: inspDesc,
                            findings_text: inspDesc,
                            defect_description: defectDesc,
                            inspection_description: inspDesc,
                            description: defectDesc
                        };
                    });
            };

            const getSubFindings = (secId: string, filterFn?: (f: any) => boolean) => {
                return rawFindings
                    .filter((f: any) => isItemMatchingSection(f, secId))
                    .filter(filterFn || (() => true))
                    .map((f: any, i: number) => ({
                        ...f,
                        no: i + 1,
                        id: i + 1,
                        defect_description: f.defect_description || f.defectDescription || f.findings || f.description || "-",
                        inspection_description: f.inspection_description || f.inspectionDescription || f.findings || f.description || "-",
                        findings: f.findings || f.description || "-",
                        description: f.findings || f.description || "-"
                    }));
            };

            // Sections (User-Written) with section-specific filtered lists and global tables
            const enrichedSections = sections.map((sec) => {
                const secAnomalies = getSubAnomalies(sec.id);
                const secAnomaliesROV = getSubAnomalies(sec.id, isROV);
                const secAnomaliesDive = getSubAnomalies(sec.id, isDiving);
                const secAnomaliesAbove = getSubAnomalies(sec.id, isAboveWater);
                const secAnomaliesUnder = getSubAnomalies(sec.id, isUnderwater);

                const secFindings = getSubFindings(sec.id);
                const secFindingsROV = getSubFindings(sec.id, isROV);
                const secFindingsDive = getSubFindings(sec.id, isDiving);
                const secFindingsAbove = getSubFindings(sec.id, isAboveWater);
                const secFindingsUnder = getSubFindings(sec.id, isUnderwater);

                const secRecords = getSubRecords(sec.id);
                const secRecordsROV = getSubRecords(sec.id, isROV);
                const secRecordsDive = getSubRecords(sec.id, isDiving);
                const secRecordsAbove = getSubRecords(sec.id, isAboveWater);
                const secRecordsUnder = getSubRecords(sec.id, isUnderwater);

                const secOutstanding = outstandingRawList
                    .filter((item: any) => isItemMatchingSection(item, sec.id))
                    .map((item: any, idx: number) => ({
                        ...item,
                        id: idx + 1,
                        no: idx + 1
                    }));

                return {
                    ...sec,
                    // Section-specific filtered tables
                    SECTION_ANOMALIES: secAnomalies,
                    SECTION_ANOMALIES_ROV: secAnomaliesROV,
                    SECTION_ANOMALIES_DIVE: secAnomaliesDive,
                    SECTION_ANOMALIES_ABOVE_WATER: secAnomaliesAbove,
                    SECTION_ANOMALIES_UNDERWATER: secAnomaliesUnder,
                    SECTION_ANOMALIES_TOP: secAnomaliesAbove,
                    SECTION_ANOMALIES_SUB: secAnomaliesUnder,
                    HAS_SECTION_ANOMALIES: secAnomalies.length > 0,
                    HAS_SECTION_ANOMALIES_ROV: secAnomaliesROV.length > 0,
                    HAS_SECTION_ANOMALIES_DIVE: secAnomaliesDive.length > 0,
                    HAS_SECTION_ANOMALIES_ABOVE_WATER: secAnomaliesAbove.length > 0,
                    HAS_SECTION_ANOMALIES_UNDERWATER: secAnomaliesUnder.length > 0,

                    SECTION_FINDINGS: secFindings,
                    SECTION_FINDINGS_ROV: secFindingsROV,
                    SECTION_FINDINGS_DIVE: secFindingsDive,
                    SECTION_FINDINGS_ABOVE_WATER: secFindingsAbove,
                    SECTION_FINDINGS_UNDERWATER: secFindingsUnder,
                    SECTION_FINDINGS_TOP: secFindingsAbove,
                    SECTION_FINDINGS_SUB: secFindingsUnder,
                    HAS_SECTION_FINDINGS: secFindings.length > 0,
                    HAS_SECTION_FINDINGS_ROV: secFindingsROV.length > 0,
                    HAS_SECTION_FINDINGS_DIVE: secFindingsDive.length > 0,
                    HAS_SECTION_FINDINGS_ABOVE_WATER: secFindingsAbove.length > 0,
                    HAS_SECTION_FINDINGS_UNDERWATER: secFindingsUnder.length > 0,

                    SECTION_RECORDS: secRecords,
                    SECTION_RECORDS_ROV: secRecordsROV,
                    SECTION_RECORDS_DIVE: secRecordsDive,
                    SECTION_RECORDS_ABOVE_WATER: secRecordsAbove,
                    SECTION_RECORDS_UNDERWATER: secRecordsUnder,
                    SECTION_RECORDS_TOP: secRecordsAbove,
                    SECTION_RECORDS_SUB: secRecordsUnder,
                    HAS_SECTION_RECORDS: secRecords.length > 0,
                    HAS_SECTION_RECORDS_ROV: secRecordsROV.length > 0,
                    HAS_SECTION_RECORDS_DIVE: secRecordsDive.length > 0,
                    HAS_SECTION_RECORDS_ABOVE_WATER: secRecordsAbove.length > 0,
                    HAS_SECTION_RECORDS_UNDERWATER: secRecordsUnder.length > 0,

                    SECTION_OUTSTANDING_TASKS: secOutstanding,
                    HAS_SECTION_OUTSTANDING_TASKS: secOutstanding.length > 0,

                    // Global summary tables (also accessible inside section)
                    HAS_ANOMALIES: totalAnomCount > 0,
                    HAS_FINDINGS: totalFindingsCount > 0,
                    HAS_SOW_SUMMARY: (insightData?.data?.sow_summary || []).length > 0,
                    HAS_OUTSTANDING_TASKS: outstandingRawList.length > 0,
                    NO_OUTSTANDING_TASKS: outstandingRawList.length === 0,
                    ANOMALY_SUMMARY_TABLE: categoryStats,
                    ANOMALY_SUMMARY_TOTAL_NOT_RECTIFIED: totalNotRectified,
                    ANOMALY_SUMMARY_TOTAL_RECTIFIED: totalRectified,
                    ANOMALY_SUMMARY_TOTAL: totalAnomCount,
                    FINDINGS_SUMMARY_TABLE: findingsCategoryStats,
                    FINDINGS_SUMMARY_TOTAL_NOT_RECTIFIED: totalFindingsNotRectified,
                    FINDINGS_SUMMARY_TOTAL_RECTIFIED: totalFindingsRectified,
                    FINDINGS_SUMMARY_TOTAL: totalFindingsCount,
                    SOW_SUMMARY: insightData?.data?.sow_summary || [],
                    ANOMALIES: rawAnomalies,
                    ANOMALIES_P1: getFilteredAnomalies((x: any) => String(x.priority || "").trim().toUpperCase() === "P1"),
                    ANOMALIES_P2: getFilteredAnomalies((x: any) => String(x.priority || "").trim().toUpperCase() === "P2"),
                    ANOMALIES_P3: getFilteredAnomalies((x: any) => String(x.priority || "").trim().toUpperCase() === "P3"),
                    RECTIFIED_ANOMALIES: rawAnomalies.filter((a: any) => a.is_rectified),
                    NOT_RECTIFIED_ANOMALIES: rawAnomalies.filter((a: any) => !a.is_rectified),
                    HAS_RECTIFIED_ANOMALIES: rawAnomalies.some((a: any) => a.is_rectified),
                    HAS_NOT_RECTIFIED_ANOMALIES: rawAnomalies.some((a: any) => !a.is_rectified),
                    FINDINGS: rawFindings,
                    OUTSTANDING_TASKS: outstandingRawList.map((t: any, idx: number) => ({
                        ...t,
                        no: idx + 1
                    })),
                    INCOMPLETE_RECORDS: incompleteRecords,
                    INCOMPLETE_ROV: incompleteRecords.filter(isROV),
                    INCOMPLETE_DIVE: incompleteRecords.filter(isDiving),
                    HAS_INCOMPLETE_RECORDS: incompleteRecords.length > 0,
                    HAS_INCOMPLETE_ROV: incompleteRecords.some(isROV),
                    HAS_INCOMPLETE_DIVE: incompleteRecords.some(isDiving),
                    CP_RECORDS: insightData?.data?.cp_items || [],
                    FMD_RECORDS: insightData?.data?.fmd_items || [],
                    MGI_RECORDS: insightData?.data?.mgi_items || [],
                    STATS: insightData?.data?.records || {},
                    ...mappedData
                };
            });

            const reportData: Record<string, any> = {
                STRUCTURE_VISUALS: structureVisuals,
                HAS_VISUALS: structureVisuals.length > 0,
                HAS_ANOMALIES: totalAnomCount > 0,
                HAS_FINDINGS: totalFindingsCount > 0,

                // Global ROV vs Diver Anomalies & Findings
                ANOMALIES_ROV: rawAnomalies.filter(isROV).map((a, i) => ({ ...a, no: i + 1, id: i + 1 })),
                ANOMALIES_DIVE: rawAnomalies.filter(isDiving).map((a, i) => ({ ...a, no: i + 1, id: i + 1 })),
                HAS_ANOMALIES_ROV: rawAnomalies.some(isROV),
                HAS_ANOMALIES_DIVE: rawAnomalies.some(isDiving),

                RECTIFIED_ANOMALIES: rawAnomalies.filter((a: any) => a.is_rectified).map((a, i) => ({ ...a, no: i + 1, id: i + 1 })),
                NOT_RECTIFIED_ANOMALIES: rawAnomalies.filter((a: any) => !a.is_rectified).map((a, i) => ({ ...a, no: i + 1, id: i + 1 })),
                HAS_RECTIFIED_ANOMALIES: rawAnomalies.some((a: any) => a.is_rectified),
                HAS_NOT_RECTIFIED_ANOMALIES: rawAnomalies.some((a: any) => !a.is_rectified),

                INCOMPLETE_RECORDS: incompleteRecords,
                INCOMPLETE_ROV: incompleteRecords.filter(isROV),
                INCOMPLETE_DIVE: incompleteRecords.filter(isDiving),
                HAS_INCOMPLETE_RECORDS: incompleteRecords.length > 0,
                HAS_INCOMPLETE_ROV: incompleteRecords.some(isROV),
                HAS_INCOMPLETE_DIVE: incompleteRecords.some(isDiving),

                FINDINGS_ROV: rawFindings.filter(isROV).map((f, i) => ({ ...f, no: i + 1, id: i + 1 })),
                FINDINGS_DIVE: rawFindings.filter(isDiving).map((f, i) => ({ ...f, no: i + 1, id: i + 1 })),
                HAS_FINDINGS_ROV: rawFindings.some(isROV),
                HAS_FINDINGS_DIVE: rawFindings.some(isDiving),

                // ── Anomaly Summary Table Data ───────────────────────
                ANOMALY_SUMMARY_TABLE: categoryStats,
                ANOMALY_SUMMARY_TOTAL_NOT_RECTIFIED: totalNotRectified,
                ANOMALY_SUMMARY_TOTAL_RECTIFIED: totalRectified,
                ANOMALY_SUMMARY_TOTAL: totalAnomCount,

                // ── Findings Summary Table Data ──────────────────────
                FINDINGS_SUMMARY_TABLE: findingsCategoryStats,
                FINDINGS_SUMMARY_TOTAL_NOT_RECTIFIED: totalFindingsNotRectified,
                FINDINGS_SUMMARY_TOTAL_RECTIFIED: totalFindingsRectified,
                FINDINGS_SUMMARY_TOTAL: totalFindingsCount,

                OBS_NOT_RECTIFIED: obsAnoms.length - getRectifiedCount(obsAnoms),
                OBS_RECTIFIED: getRectifiedCount(obsAnoms),
                OBS_TOTAL: obsAnoms.length,
                OBS_COLOR_HEX: obsColorHex,
                OBS_COLOR_RGB: obsColorRgb,
                OBS_COLOR_XML: `<w:tcPr><w:shd w:fill="${obsColorHex}"/></w:tcPr>`,

                P1_NOT_RECTIFIED: p1Anoms.length - getRectifiedCount(p1Anoms),
                P1_RECTIFIED: getRectifiedCount(p1Anoms),
                P1_TOTAL: p1Anoms.length,
                P1_COLOR_HEX: p1ColorHex,
                P1_COLOR_RGB: p1ColorRgb,
                P1_COLOR_XML: `<w:tcPr><w:shd w:fill="${p1ColorHex}"/></w:tcPr>`,

                P2_NOT_RECTIFIED: p2Anoms.length - getRectifiedCount(p2Anoms),
                P2_RECTIFIED: getRectifiedCount(p2Anoms),
                P2_TOTAL: p2Anoms.length,
                P2_COLOR_HEX: p2ColorHex,
                P2_COLOR_RGB: p2ColorRgb,
                P2_COLOR_XML: `<w:tcPr><w:shd w:fill="${p2ColorHex}"/></w:tcPr>`,

                P3_NOT_RECTIFIED: p3Anoms.length - getRectifiedCount(p3Anoms),
                P3_RECTIFIED: getRectifiedCount(p3Anoms),
                P3_TOTAL: p3Anoms.length,
                P3_COLOR_HEX: p3ColorHex,
                P3_COLOR_RGB: p3ColorRgb,
                P3_COLOR_XML: `<w:tcPr><w:shd w:fill="${p3ColorHex}"/></w:tcPr>`,

                // ── Custom User Variables ────────────────────────────
                ...Object.fromEntries(
                    Object.entries(customVariables).map(([k, v]) => [k.toUpperCase(), v])
                ),

                // ── Core Project Identifiers ─────────────────────────
                PLATFORM_TITLE: str?.str_name || "N/A",
                PLATFORM_NAME: str?.str_name || "N/A",
                FIELD_NAME: str?.field_name || "N/A",
                JOB_PACK_NAME: jp?.name || "N/A",
                REPORT_NO: selections.sowReportNo,
                SOW_REPORT_NO: selections.sowReportNo,
                REPORT_TYPE: reportType.toUpperCase(),
                DATE: new Date().toLocaleDateString("en-GB"),
                SHORT_DATE: (() => {
                    const dateStr = jp?.metadata?.istart || jp?.start_date;
                    if (!dateStr) return "N/A";
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return "N/A";
                    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    return `${months[d.getMonth()]} ${d.getFullYear()}`;
                })(),
                TODAY_SHORT: (() => {
                    const d = new Date();
                    const day = String(d.getDate()).padStart(2, '0');
                    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
                })(),

                // ── Company / Client Info ────────────────────────────
                CLIENT_NAME: companySettings?.data?.company_name || jp?.metadata?.contrac || "N/A",
                CLIENT_SHORT: (() => {
                    const clientName = companySettings?.data?.company_name;
                    if (!clientName) return "N/A";
                    const matched = contractors.find((c: any) => 
                        String(c.lib_desc || "").toLowerCase().replace(/[^a-z0-9]/g, "") === 
                        String(clientName).toLowerCase().replace(/[^a-z0-9]/g, "")
                    );
                    if (matched) return matched.lib_id || "N/A";
                    const partialMatch = contractors.find((c: any) => 
                        String(c.lib_desc || "").toLowerCase().includes(String(clientName).toLowerCase()) ||
                        String(clientName).toLowerCase().includes(String(c.lib_desc || "").toLowerCase())
                    );
                    if (partialMatch) return partialMatch.lib_id || "N/A";
                    return "N/A";
                })(),
                DEPARTMENT: companySettings?.data?.department_name || "N/A",
                PROJECT_NAME: companySettings?.data?.project_name || "N/A",

                // ── Job Pack Metadata ────────────────────────────────
                VESSEL_NAME: jp?.metadata?.vessel || "NONE",
                VESSELS_INVOLVED: (() => {
                    if (jp?.metadata?.vessel_history && Array.isArray(jp.metadata.vessel_history)) {
                        const names = jp.metadata.vessel_history.map((v: any) => v.name).filter(Boolean);
                        const uniqueNames = Array.from(new Set(names));
                        if (uniqueNames.length > 0) return uniqueNames.join(", ");
                    }
                    return jp?.metadata?.vessel || "NONE";
                })(),
                INSPECTION_YEAR: (() => {
                    const dateStr = jp?.metadata?.istart || jp?.start_date;
                    if (!dateStr) return "N/A";
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return "N/A";
                    return d.getFullYear().toString();
                })(),
                PROJECT_NO: jp?.metadata?.inspno || jp?.project_no || "N/A",
                CONTRACTOR: jp?.metadata?.contrac || "N/A",
                START_DATE: jp?.metadata?.istart ? new Date(jp.metadata.istart).toLocaleDateString("en-GB") : (jp?.start_date || "N/A"),
                END_DATE: jp?.metadata?.iend ? new Date(jp.metadata.iend).toLocaleDateString("en-GB") : (jp?.end_date || "N/A"),
                TASK_TYPE: jp?.metadata?.tasktype || "N/A",
                PLAN_TYPE: jp?.metadata?.plantype || "N/A",
                INSPECTION_MODE: (() => {
                    const modes: any[] = [];
                    if (jp?.metadata?.rov === 1 || jp?.metadata?.methods?.includes("ROV")) {
                        modes.push("ROV");
                    }
                    if (jp?.metadata?.divetyp) {
                        modes.push(jp.metadata.divetyp.toUpperCase());
                    } else if (jp?.metadata?.methods?.includes("DIVE")) {
                        modes.push("DIVING");
                    }
                    return modes.join(" / ") || "N/A";
                })(),
                PROJECT_SCOPE: (() => {
                    const scopes: any[] = [];
                    if (Number(jp?.metadata?.topside) === 1) scopes.push("Topside");
                    if (Number(jp?.metadata?.subsea) === 1) scopes.push("Subsea");
                    return scopes.join(" / ") || "N/A";
                })(),
                COMPANY_REP: jp?.metadata?.comprep || "N/A",
                CONTRACT_REF: jp?.metadata?.contract_ref || "N/A",
                CONTRACTOR_REF: jp?.metadata?.contractor_ref || "N/A",
                STATUS: jp?.status || "N/A",
                CONTRACTOR_NAME: activeContractor?.lib_desc || jp?.metadata?.contrac || "N/A",
                CONTRACTOR_NAME_UPPER: (activeContractor?.lib_desc || jp?.metadata?.contrac || "N/A").toUpperCase(),
                CONTRACTOR_SHORT: jp?.metadata?.contrac || "N/A",
                CONTRACTOR_SHORT_UPPER: (jp?.metadata?.contrac || "N/A").toUpperCase(),
                CONTRACTOR_ADDRESS: activeContractor?.lib_com || "N/A",
                CONTRACTOR_LOGO: activeContractor?.logo_url ? { data: activeContractor.logo_url, extension: '.jpg' } : "",

                // ── Signatories ──────────────────────────────────────
                PREPARED_BY: insightData?.data?.prepared_by?.name || "System",
                REVIEW_BY: insightData?.data?.reviewed_by?.name || "-",
                APPROVE_BY: insightData?.data?.approved_by?.name || "-",

                // ── Summary Stats ────────────────────────────────────
                SOW_COMPLETION: insightData?.data?.sow?.completionPct || 0,
                TOTAL_RECORDS: insightData?.data?.records?.total || 0,

                // ── Anomaly / Finding Stats ──────────────────────────
                TOTAL_ANOMALIES: insightData?.data?.anomalies?.total || 0,
                OPEN_ANOMALIES: insightData?.data?.anomalies?.open || 0,
                RECTIFIED_ANOMALIES_COUNT: insightData?.data?.anomalies?.rectified || 0,
                P1_ANOMALIES: insightData?.data?.anomalies?.byPriority?.P1 || 0,
                P2_ANOMALIES: insightData?.data?.anomalies?.byPriority?.P2 || 0,
                P3_ANOMALIES: insightData?.data?.anomalies?.byPriority?.P3 || 0,

                // ── Inspection Metrics ───────────────────────────────
                CP_MIN: insightData?.data?.cp?.minVal || "N/A",
                CP_MAX: insightData?.data?.cp?.maxVal || "N/A",
                MGI_MIN: insightData?.data?.mgi?.min || 0,
                MGI_MIN_COMP: insightData?.data?.mgi?.minComp || "N/A",
                MGI_MAX: insightData?.data?.mgi?.max || 0,
                MGI_MAX_COMP: insightData?.data?.mgi?.maxComp || "N/A",
                MGI_HARD_MIN_PCT: insightData?.data?.mgi?.hardMinPct || 0,
                MGI_HARD_MIN_PCT_COMP: insightData?.data?.mgi?.hardMinPctComp || "N/A",
                MGI_HARD_MAX_PCT: insightData?.data?.mgi?.hardMaxPct || 0,
                MGI_HARD_MAX_PCT_COMP: insightData?.data?.mgi?.hardMaxPctComp || "N/A",
                MGI_SOFT_MIN_PCT: insightData?.data?.mgi?.softMinPct || 0,
                MGI_SOFT_MIN_PCT_COMP: insightData?.data?.mgi?.softMinPctComp || "N/A",
                MGI_SOFT_MAX_PCT: insightData?.data?.mgi?.softMaxPct || 0,
                MGI_SOFT_MAX_PCT_COMP: insightData?.data?.mgi?.softMaxPctComp || "N/A",
                MGI_AVG: Math.round(insightData?.data?.mgi?.avg || 0),
                SCOUR_EXPOSED: insightData?.data?.scour?.exposed || 0,
                SCOUR_EXPOSED_LOCATIONS: insightData?.data?.scour?.exposedLocationsStr || "None",
                SCOUR_MAX_DEPTH: insightData?.data?.scour?.maxDepth || 0,
                SCOUR_MAX_LEG: insightData?.data?.scour?.maxDepthLeg || "N/A",
                SCOUR_MAX_FACE: insightData?.data?.scour?.maxDepthFace || "N/A",
                SCOUR_MAX_QID: insightData?.data?.scour?.maxDepthQid || "N/A",

                // Sections (User-Written)
                SECTIONS: enrichedSections,
                NEXT_PARAGRAPH_NO: `1.${sections.length + 1}`,
                NEXT_NO: sections.length + 1,
                HAS_OUTSTANDING_TASKS: outstandingRawList.length > 0,
                NO_OUTSTANDING_TASKS: outstandingRawList.length === 0,
                OUTSTANDING_TASKS: outstandingRawList.map((t: any, idx: number) => ({
                    ...t,
                    no: idx + 1
                })),
                OUTSTANDING_GROUPS: (() => {
                    const groupsMap = new Map<string, any[]>();
                    outstandingRawList.forEach((t: any) => {
                        const type = t.inspectionType || "General Inspection";
                        if (!groupsMap.has(type)) groupsMap.set(type, []);
                        groupsMap.get(type)!.push(t);
                    });
                    return Array.from(groupsMap.entries()).map(([type, items]) => ({
                        inspectionType: type,
                        totalCount: items.length,
                        tasks: items.map((item, idx) => ({
                            ...item,
                            no: idx + 1
                        }))
                    }));
                })(),

                // ── Detailed Loop Tables ─────────────────────────────
                ANOMALIES: rawAnomalies,
                ANOMALIES_P1: getFilteredAnomalies((x: any) => String(x.priority || "").trim().toUpperCase() === "P1"),
                ANOMALIES_P2: getFilteredAnomalies((x: any) => String(x.priority || "").trim().toUpperCase() === "P2"),
                ANOMALIES_P3: getFilteredAnomalies((x: any) => String(x.priority || "").trim().toUpperCase() === "P3"),

                // Specific component-filtered anomaly lists & flags
                ANOMALIES_GVI: getSubAnomalies("gvi"),
                ANOMALIES_GVI_ROV: getSubAnomalies("gvi", isROV),
                ANOMALIES_GVI_DIVE: getSubAnomalies("gvi", isDiving),
                ANOMALIES_RGVI: getSubAnomalies("gvi", isROV),
                ANOMALIES_DGVI: getSubAnomalies("gvi", isDiving),
                HAS_ANOMALIES_GVI: rawAnomalies.some((a: any) => isItemMatchingSection(a, "gvi")),
                HAS_ANOMALIES_GVI_ROV: rawAnomalies.some((a: any) => isItemMatchingSection(a, "gvi") && isROV(a)),
                HAS_ANOMALIES_GVI_DIVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "gvi") && isDiving(a)),
                HAS_ANOMALIES_RGVI: rawAnomalies.some((a: any) => isItemMatchingSection(a, "gvi") && isROV(a)),
                HAS_ANOMALIES_DGVI: rawAnomalies.some((a: any) => isItemMatchingSection(a, "gvi") && isDiving(a)),

                FINDINGS_GVI: getSubFindings("gvi"),
                FINDINGS_GVI_ROV: getSubFindings("gvi", isROV),
                FINDINGS_GVI_DIVE: getSubFindings("gvi", isDiving),
                FINDINGS_RGVI: getSubFindings("gvi", isROV),
                FINDINGS_DGVI: getSubFindings("gvi", isDiving),
                HAS_FINDINGS_GVI: rawFindings.some((f: any) => isItemMatchingSection(f, "gvi")),
                HAS_FINDINGS_GVI_ROV: rawFindings.some((f: any) => isItemMatchingSection(f, "gvi") && isROV(f)),
                HAS_FINDINGS_GVI_DIVE: rawFindings.some((f: any) => isItemMatchingSection(f, "gvi") && isDiving(f)),

                // ── Caisson & Caisson Guard Anomalies & Findings ──
                ANOMALIES_CAISSON: getSubAnomalies("caisson"),
                ANOMALIES_CAISSON_ROV: getSubAnomalies("caisson", isROV),
                ANOMALIES_CAISSON_DIVE: getSubAnomalies("caisson", isDiving),
                ANOMALIES_RCAISSON: getSubAnomalies("caisson", isROV),
                ANOMALIES_DCAISSON: getSubAnomalies("caisson", isDiving),
                ANOMALIES_CAISSON_ABOVE: getSubAnomalies("caisson", isAboveWater),
                ANOMALIES_CAISSON_UNDER: getSubAnomalies("caisson", isUnderwater),
                ANOMALIES_CAISSON_ABOVE_WATER: getSubAnomalies("caisson", isAboveWater),
                ANOMALIES_CAISSON_UNDERWATER: getSubAnomalies("caisson", isUnderwater),
                ANOMALIES_CAISSON_TOP: getSubAnomalies("caisson", isAboveWater),
                ANOMALIES_CAISSON_SUB: getSubAnomalies("caisson", isUnderwater),
                HAS_ANOMALIES_CAISSON: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caisson")),
                HAS_ANOMALIES_CAISSON_ROV: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caisson") && isROV(a)),
                HAS_ANOMALIES_CAISSON_DIVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caisson") && isDiving(a)),
                HAS_ANOMALIES_RCAISSON: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caisson") && isROV(a)),
                HAS_ANOMALIES_DCAISSON: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caisson") && isDiving(a)),
                HAS_ANOMALIES_CAISSON_ABOVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caisson") && isAboveWater(a)),
                HAS_ANOMALIES_CAISSON_UNDER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caisson") && isUnderwater(a)),
                HAS_ANOMALIES_CAISSON_ABOVE_WATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caisson") && isAboveWater(a)),
                HAS_ANOMALIES_CAISSON_UNDERWATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caisson") && isUnderwater(a)),
                HAS_ANOMALIES_CAISSON_TOP: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caisson") && isAboveWater(a)),
                HAS_ANOMALIES_CAISSON_SUB: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caisson") && isUnderwater(a)),

                ANOMALIES_CAISSON_GUARD_ABOVE: getSubAnomalies("caissonguard_top", isAboveWater),
                ANOMALIES_CAISSON_GUARD_UNDER: getSubAnomalies("caissonguard_sub", isUnderwater),
                ANOMALIES_CAISSON_GUARD_ABOVE_WATER: getSubAnomalies("caissonguard_top", isAboveWater),
                ANOMALIES_CAISSON_GUARD_UNDERWATER: getSubAnomalies("caissonguard_sub", isUnderwater),
                ANOMALIES_CAISSONGUARD_ABOVE: getSubAnomalies("caissonguard_top", isAboveWater),
                ANOMALIES_CAISSONGUARD_UNDER: getSubAnomalies("caissonguard_sub", isUnderwater),
                ANOMALIES_CAISSONGUARD_ABOVE_WATER: getSubAnomalies("caissonguard_top", isAboveWater),
                ANOMALIES_CAISSONGUARD_UNDERWATER: getSubAnomalies("caissonguard_sub", isUnderwater),
                HAS_ANOMALIES_CAISSON_GUARD_ABOVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caissonguard_top") && isAboveWater(a)),
                HAS_ANOMALIES_CAISSON_GUARD_UNDER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caissonguard_sub") && isUnderwater(a)),
                HAS_ANOMALIES_CAISSON_GUARD_ABOVE_WATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caissonguard_top") && isAboveWater(a)),
                HAS_ANOMALIES_CAISSON_GUARD_UNDERWATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caissonguard_sub") && isUnderwater(a)),
                HAS_ANOMALIES_CAISSONGUARD_ABOVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caissonguard_top") && isAboveWater(a)),
                HAS_ANOMALIES_CAISSONGUARD_UNDER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caissonguard_sub") && isUnderwater(a)),
                HAS_ANOMALIES_CAISSONGUARD_ABOVE_WATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caissonguard_top") && isAboveWater(a)),
                HAS_ANOMALIES_CAISSONGUARD_UNDERWATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "caissonguard_sub") && isUnderwater(a)),

                FINDINGS_CAISSON: getSubFindings("caisson"),
                FINDINGS_CAISSON_ROV: getSubFindings("caisson", isROV),
                FINDINGS_CAISSON_DIVE: getSubFindings("caisson", isDiving),
                FINDINGS_RCAISSON: getSubFindings("caisson", isROV),
                FINDINGS_DCAISSON: getSubFindings("caisson", isDiving),
                FINDINGS_CAISSON_ABOVE: getSubFindings("caisson", isAboveWater),
                FINDINGS_CAISSON_UNDER: getSubFindings("caisson", isUnderwater),
                FINDINGS_CAISSON_ABOVE_WATER: getSubFindings("caisson", isAboveWater),
                FINDINGS_CAISSON_UNDERWATER: getSubFindings("caisson", isUnderwater),
                HAS_FINDINGS_CAISSON: rawFindings.some((f: any) => isItemMatchingSection(f, "caisson")),
                HAS_FINDINGS_CAISSON_ROV: rawFindings.some((f: any) => isItemMatchingSection(f, "caisson") && isROV(f)),
                HAS_FINDINGS_CAISSON_DIVE: rawFindings.some((f: any) => isItemMatchingSection(f, "caisson") && isDiving(f)),
                HAS_FINDINGS_CAISSON_ABOVE: rawFindings.some((f: any) => isItemMatchingSection(f, "caisson") && isAboveWater(f)),
                HAS_FINDINGS_CAISSON_UNDER: rawFindings.some((f: any) => isItemMatchingSection(f, "caisson") && isUnderwater(f)),
                HAS_FINDINGS_CAISSON_ABOVE_WATER: rawFindings.some((f: any) => isItemMatchingSection(f, "caisson") && isAboveWater(f)),
                HAS_FINDINGS_CAISSON_UNDERWATER: rawFindings.some((f: any) => isItemMatchingSection(f, "caisson") && isUnderwater(f)),

                // ── Conductor & Conductor Guard Anomalies & Findings ──
                ANOMALIES_CONDUCTOR: getSubAnomalies("conductor"),
                ANOMALIES_CONDUCTOR_ROV: getSubAnomalies("conductor", isROV),
                ANOMALIES_CONDUCTOR_DIVE: getSubAnomalies("conductor", isDiving),
                ANOMALIES_RCONDUCTOR: getSubAnomalies("conductor", isROV),
                ANOMALIES_DCONDUCTOR: getSubAnomalies("conductor", isDiving),
                ANOMALIES_CONDUCTOR_ABOVE: getSubAnomalies("conductor", isAboveWater),
                ANOMALIES_CONDUCTOR_UNDER: getSubAnomalies("conductor", isUnderwater),
                ANOMALIES_CONDUCTOR_ABOVE_WATER: getSubAnomalies("conductor", isAboveWater),
                ANOMALIES_CONDUCTOR_UNDERWATER: getSubAnomalies("conductor", isUnderwater),
                ANOMALIES_CONDUCTOR_TOP: getSubAnomalies("conductor", isAboveWater),
                ANOMALIES_CONDUCTOR_SUB: getSubAnomalies("conductor", isUnderwater),
                HAS_ANOMALIES_CONDUCTOR: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductor")),
                HAS_ANOMALIES_CONDUCTOR_ROV: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductor") && isROV(a)),
                HAS_ANOMALIES_CONDUCTOR_DIVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductor") && isDiving(a)),
                HAS_ANOMALIES_RCONDUCTOR: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductor") && isROV(a)),
                HAS_ANOMALIES_DCONDUCTOR: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductor") && isDiving(a)),
                HAS_ANOMALIES_CONDUCTOR_ABOVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductor") && isAboveWater(a)),
                HAS_ANOMALIES_CONDUCTOR_UNDER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductor") && isUnderwater(a)),
                HAS_ANOMALIES_CONDUCTOR_ABOVE_WATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductor") && isAboveWater(a)),
                HAS_ANOMALIES_CONDUCTOR_UNDERWATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductor") && isUnderwater(a)),
                HAS_ANOMALIES_CONDUCTOR_TOP: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductor") && isAboveWater(a)),
                HAS_ANOMALIES_CONDUCTOR_SUB: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductor") && isUnderwater(a)),

                ANOMALIES_CONDUCTOR_GUARD_ABOVE: getSubAnomalies("conductorguard_top", isAboveWater),
                ANOMALIES_CONDUCTOR_GUARD_UNDER: getSubAnomalies("conductorguard_sub", isUnderwater),
                ANOMALIES_CONDUCTOR_GUARD_ABOVE_WATER: getSubAnomalies("conductorguard_top", isAboveWater),
                ANOMALIES_CONDUCTOR_GUARD_UNDERWATER: getSubAnomalies("conductorguard_sub", isUnderwater),
                ANOMALIES_CONDUCTORGUARD_ABOVE: getSubAnomalies("conductorguard_top", isAboveWater),
                ANOMALIES_CONDUCTORGUARD_UNDER: getSubAnomalies("conductorguard_sub", isUnderwater),
                ANOMALIES_CONDUCTORGUARD_ABOVE_WATER: getSubAnomalies("conductorguard_top", isAboveWater),
                ANOMALIES_CONDUCTORGUARD_UNDERWATER: getSubAnomalies("conductorguard_sub", isUnderwater),
                HAS_ANOMALIES_CONDUCTOR_GUARD_ABOVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductorguard_top") && isAboveWater(a)),
                HAS_ANOMALIES_CONDUCTOR_GUARD_UNDER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductorguard_sub") && isUnderwater(a)),
                HAS_ANOMALIES_CONDUCTOR_GUARD_ABOVE_WATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductorguard_top") && isAboveWater(a)),
                HAS_ANOMALIES_CONDUCTOR_GUARD_UNDERWATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductorguard_sub") && isUnderwater(a)),
                HAS_ANOMALIES_CONDUCTORGUARD_ABOVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductorguard_top") && isAboveWater(a)),
                HAS_ANOMALIES_CONDUCTORGUARD_UNDER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductorguard_sub") && isUnderwater(a)),
                HAS_ANOMALIES_CONDUCTORGUARD_ABOVE_WATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductorguard_top") && isAboveWater(a)),
                HAS_ANOMALIES_CONDUCTORGUARD_UNDERWATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "conductorguard_sub") && isUnderwater(a)),

                FINDINGS_CONDUCTOR: getSubFindings("conductor"),
                FINDINGS_CONDUCTOR_ROV: getSubFindings("conductor", isROV),
                FINDINGS_CONDUCTOR_DIVE: getSubFindings("conductor", isDiving),
                FINDINGS_RCONDUCTOR: getSubFindings("conductor", isROV),
                FINDINGS_DCONDUCTOR: getSubFindings("conductor", isDiving),
                FINDINGS_CONDUCTOR_ABOVE: getSubFindings("conductor", isAboveWater),
                FINDINGS_CONDUCTOR_UNDER: getSubFindings("conductor", isUnderwater),
                FINDINGS_CONDUCTOR_ABOVE_WATER: getSubFindings("conductor", isAboveWater),
                FINDINGS_CONDUCTOR_UNDERWATER: getSubFindings("conductor", isUnderwater),
                HAS_FINDINGS_CONDUCTOR: rawFindings.some((f: any) => isItemMatchingSection(f, "conductor")),
                HAS_FINDINGS_CONDUCTOR_ROV: rawFindings.some((f: any) => isItemMatchingSection(f, "conductor") && isROV(f)),
                HAS_FINDINGS_CONDUCTOR_DIVE: rawFindings.some((f: any) => isItemMatchingSection(f, "conductor") && isDiving(f)),
                HAS_FINDINGS_CONDUCTOR_ABOVE: rawFindings.some((f: any) => isItemMatchingSection(f, "conductor") && isAboveWater(f)),
                HAS_FINDINGS_CONDUCTOR_UNDER: rawFindings.some((f: any) => isItemMatchingSection(f, "conductor") && isUnderwater(f)),
                HAS_FINDINGS_CONDUCTOR_ABOVE_WATER: rawFindings.some((f: any) => isItemMatchingSection(f, "conductor") && isAboveWater(f)),
                HAS_FINDINGS_CONDUCTOR_UNDERWATER: rawFindings.some((f: any) => isItemMatchingSection(f, "conductor") && isUnderwater(f)),

                // ── Risers (RISI) Anomalies & Findings ──
                ANOMALIES_RISER: getSubAnomalies("riser"),
                ANOMALIES_RISER_ROV: getSubAnomalies("riser", isROV),
                ANOMALIES_RISER_DIVE: getSubAnomalies("riser", isDiving),
                ANOMALIES_RRISER: getSubAnomalies("riser", isROV),
                ANOMALIES_DRISER: getSubAnomalies("riser", isDiving),
                ANOMALIES_RISER_ABOVE: getSubAnomalies("riser", isAboveWater),
                ANOMALIES_RISER_UNDER: getSubAnomalies("riser", isUnderwater),
                ANOMALIES_RISER_ABOVE_WATER: getSubAnomalies("riser", isAboveWater),
                ANOMALIES_RISER_UNDERWATER: getSubAnomalies("riser", isUnderwater),
                ANOMALIES_RISER_TOP: getSubAnomalies("riser", isAboveWater),
                ANOMALIES_RISER_SUB: getSubAnomalies("riser", isUnderwater),
                HAS_ANOMALIES_RISER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riser")),
                HAS_ANOMALIES_RISER_ROV: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riser") && isROV(a)),
                HAS_ANOMALIES_RISER_DIVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riser") && isDiving(a)),
                HAS_ANOMALIES_RRISER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riser") && isROV(a)),
                HAS_ANOMALIES_DRISER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riser") && isDiving(a)),
                HAS_ANOMALIES_RISER_ABOVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riser") && isAboveWater(a)),
                HAS_ANOMALIES_RISER_UNDER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riser") && isUnderwater(a)),
                HAS_ANOMALIES_RISER_ABOVE_WATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riser") && isAboveWater(a)),
                HAS_ANOMALIES_RISER_UNDERWATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riser") && isUnderwater(a)),
                HAS_ANOMALIES_RISER_TOP: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riser") && isAboveWater(a)),
                HAS_ANOMALIES_RISER_SUB: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riser") && isUnderwater(a)),

                FINDINGS_RISER: getSubFindings("riser"),
                FINDINGS_RISER_ROV: getSubFindings("riser", isROV),
                FINDINGS_RISER_DIVE: getSubFindings("riser", isDiving),
                FINDINGS_RRISER: getSubFindings("riser", isROV),
                FINDINGS_DRISER: getSubFindings("riser", isDiving),
                FINDINGS_RISER_ABOVE: getSubFindings("riser", isAboveWater),
                FINDINGS_RISER_UNDER: getSubFindings("riser", isUnderwater),
                FINDINGS_RISER_ABOVE_WATER: getSubFindings("riser", isAboveWater),
                FINDINGS_RISER_UNDERWATER: getSubFindings("riser", isUnderwater),
                HAS_FINDINGS_RISER: rawFindings.some((f: any) => isItemMatchingSection(f, "riser")),
                HAS_FINDINGS_RISER_ROV: rawFindings.some((f: any) => isItemMatchingSection(f, "riser") && isROV(f)),
                HAS_FINDINGS_RISER_DIVE: rawFindings.some((f: any) => isItemMatchingSection(f, "riser") && isDiving(f)),
                HAS_FINDINGS_RISER_ABOVE: rawFindings.some((f: any) => isItemMatchingSection(f, "riser") && isAboveWater(f)),
                HAS_FINDINGS_RISER_UNDER: rawFindings.some((f: any) => isItemMatchingSection(f, "riser") && isUnderwater(f)),
                HAS_FINDINGS_RISER_ABOVE_WATER: rawFindings.some((f: any) => isItemMatchingSection(f, "riser") && isAboveWater(f)),
                HAS_FINDINGS_RISER_UNDERWATER: rawFindings.some((f: any) => isItemMatchingSection(f, "riser") && isUnderwater(f)),

                // ── Boat Landing Anomalies & Findings ──
                ANOMALIES_BOATLANDING: getSubAnomalies("boatlanding"),
                ANOMALIES_BOATLANDING_ROV: getSubAnomalies("boatlanding", isROV),
                ANOMALIES_BOATLANDING_DIVE: getSubAnomalies("boatlanding", isDiving),
                ANOMALIES_RBOATLANDING: getSubAnomalies("boatlanding", isROV),
                ANOMALIES_DBOATLANDING: getSubAnomalies("boatlanding", isDiving),
                ANOMALIES_BOATLANDING_ABOVE: getSubAnomalies("boatlanding", isAboveWater),
                ANOMALIES_BOATLANDING_UNDER: getSubAnomalies("boatlanding", isUnderwater),
                ANOMALIES_BOATLANDING_ABOVE_WATER: getSubAnomalies("boatlanding", isAboveWater),
                ANOMALIES_BOATLANDING_UNDERWATER: getSubAnomalies("boatlanding", isUnderwater),
                ANOMALIES_BOATLANDING_TOP: getSubAnomalies("boatlanding", isAboveWater),
                ANOMALIES_BOATLANDING_SUB: getSubAnomalies("boatlanding", isUnderwater),
                HAS_ANOMALIES_BOATLANDING: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatlanding")),
                HAS_ANOMALIES_BOATLANDING_ROV: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatlanding") && isROV(a)),
                HAS_ANOMALIES_BOATLANDING_DIVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatlanding") && isDiving(a)),
                HAS_ANOMALIES_RBOATLANDING: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatlanding") && isROV(a)),
                HAS_ANOMALIES_DBOATLANDING: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatlanding") && isDiving(a)),
                HAS_ANOMALIES_BOATLANDING_ABOVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatlanding") && isAboveWater(a)),
                HAS_ANOMALIES_BOATLANDING_UNDER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatlanding") && isUnderwater(a)),
                HAS_ANOMALIES_BOATLANDING_ABOVE_WATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatlanding") && isAboveWater(a)),
                HAS_ANOMALIES_BOATLANDING_UNDERWATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatlanding") && isUnderwater(a)),
                HAS_ANOMALIES_BOATLANDING_TOP: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatlanding") && isAboveWater(a)),
                HAS_ANOMALIES_BOATLANDING_SUB: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatlanding") && isUnderwater(a)),

                FINDINGS_BOATLANDING: getSubFindings("boatlanding"),
                FINDINGS_BOATLANDING_ROV: getSubFindings("boatlanding", isROV),
                FINDINGS_BOATLANDING_DIVE: getSubFindings("boatlanding", isDiving),
                FINDINGS_RBOATLANDING: getSubFindings("boatlanding", isROV),
                FINDINGS_DBOATLANDING: getSubFindings("boatlanding", isDiving),
                FINDINGS_BOATLANDING_ABOVE: getSubFindings("boatlanding", isAboveWater),
                FINDINGS_BOATLANDING_UNDER: getSubFindings("boatlanding", isUnderwater),
                FINDINGS_BOATLANDING_ABOVE_WATER: getSubFindings("boatlanding", isAboveWater),
                FINDINGS_BOATLANDING_UNDERWATER: getSubFindings("boatlanding", isUnderwater),
                HAS_FINDINGS_BOATLANDING: rawFindings.some((f: any) => isItemMatchingSection(f, "boatlanding")),
                HAS_FINDINGS_BOATLANDING_ROV: rawFindings.some((f: any) => isItemMatchingSection(f, "boatlanding") && isROV(f)),
                HAS_FINDINGS_BOATLANDING_DIVE: rawFindings.some((f: any) => isItemMatchingSection(f, "boatlanding") && isDiving(f)),
                HAS_FINDINGS_BOATLANDING_ABOVE: rawFindings.some((f: any) => isItemMatchingSection(f, "boatlanding") && isAboveWater(f)),
                HAS_FINDINGS_BOATLANDING_UNDER: rawFindings.some((f: any) => isItemMatchingSection(f, "boatlanding") && isUnderwater(f)),
                HAS_FINDINGS_BOATLANDING_ABOVE_WATER: rawFindings.some((f: any) => isItemMatchingSection(f, "boatlanding") && isAboveWater(f)),
                HAS_FINDINGS_BOATLANDING_UNDERWATER: rawFindings.some((f: any) => isItemMatchingSection(f, "boatlanding") && isUnderwater(f)),

                // ── Riser Guard Anomalies & Findings ──
                ANOMALIES_RISERGUARD: getSubAnomalies("riserguard"),
                ANOMALIES_RISERGUARD_ROV: getSubAnomalies("riserguard", isROV),
                ANOMALIES_RISERGUARD_DIVE: getSubAnomalies("riserguard", isDiving),
                ANOMALIES_RRISERGUARD: getSubAnomalies("riserguard", isROV),
                ANOMALIES_DRISERGUARD: getSubAnomalies("riserguard", isDiving),
                ANOMALIES_RISERGUARD_ABOVE: getSubAnomalies("riserguard", isAboveWater),
                ANOMALIES_RISERGUARD_UNDER: getSubAnomalies("riserguard", isUnderwater),
                ANOMALIES_RISERGUARD_ABOVE_WATER: getSubAnomalies("riserguard", isAboveWater),
                ANOMALIES_RISERGUARD_UNDERWATER: getSubAnomalies("riserguard", isUnderwater),
                ANOMALIES_RISERGUARD_TOP: getSubAnomalies("riserguard", isAboveWater),
                ANOMALIES_RISERGUARD_SUB: getSubAnomalies("riserguard", isUnderwater),
                HAS_ANOMALIES_RISERGUARD: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riserguard")),
                HAS_ANOMALIES_RISERGUARD_ROV: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riserguard") && isROV(a)),
                HAS_ANOMALIES_RISERGUARD_DIVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riserguard") && isDiving(a)),
                HAS_ANOMALIES_RRISERGUARD: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riserguard") && isROV(a)),
                HAS_ANOMALIES_DRISERGUARD: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riserguard") && isDiving(a)),
                HAS_ANOMALIES_RISERGUARD_ABOVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riserguard") && isAboveWater(a)),
                HAS_ANOMALIES_RISERGUARD_UNDER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riserguard") && isUnderwater(a)),
                HAS_ANOMALIES_RISERGUARD_ABOVE_WATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riserguard") && isAboveWater(a)),
                HAS_ANOMALIES_RISERGUARD_UNDERWATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riserguard") && isUnderwater(a)),
                HAS_ANOMALIES_RISERGUARD_TOP: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riserguard") && isAboveWater(a)),
                HAS_ANOMALIES_RISERGUARD_SUB: rawAnomalies.some((a: any) => isItemMatchingSection(a, "riserguard") && isUnderwater(a)),

                FINDINGS_RISERGUARD: getSubFindings("riserguard"),
                FINDINGS_RISERGUARD_ROV: getSubFindings("riserguard", isROV),
                FINDINGS_RISERGUARD_DIVE: getSubFindings("riserguard", isDiving),
                FINDINGS_RRISERGUARD: getSubFindings("riserguard", isROV),
                FINDINGS_DRISERGUARD: getSubFindings("riserguard", isDiving),
                FINDINGS_RISERGUARD_ABOVE: getSubFindings("riserguard", isAboveWater),
                FINDINGS_RISERGUARD_UNDER: getSubFindings("riserguard", isUnderwater),
                FINDINGS_RISERGUARD_ABOVE_WATER: getSubFindings("riserguard", isAboveWater),
                FINDINGS_RISERGUARD_UNDERWATER: getSubFindings("riserguard", isUnderwater),
                HAS_FINDINGS_RISERGUARD: rawFindings.some((f: any) => isItemMatchingSection(f, "riserguard")),
                HAS_FINDINGS_RISERGUARD_ROV: rawFindings.some((f: any) => isItemMatchingSection(f, "riserguard") && isROV(f)),
                HAS_FINDINGS_RISERGUARD_DIVE: rawFindings.some((f: any) => isItemMatchingSection(f, "riserguard") && isDiving(f)),
                HAS_FINDINGS_RISERGUARD_ABOVE: rawFindings.some((f: any) => isItemMatchingSection(f, "riserguard") && isAboveWater(f)),
                HAS_FINDINGS_RISERGUARD_UNDER: rawFindings.some((f: any) => isItemMatchingSection(f, "riserguard") && isUnderwater(f)),
                HAS_FINDINGS_RISERGUARD_ABOVE_WATER: rawFindings.some((f: any) => isItemMatchingSection(f, "riserguard") && isAboveWater(f)),
                HAS_FINDINGS_RISERGUARD_UNDERWATER: rawFindings.some((f: any) => isItemMatchingSection(f, "riserguard") && isUnderwater(f)),

                // ── Boat Bumper Anomalies & Findings ──
                ANOMALIES_BOATBUMPER: getSubAnomalies("boatbumper"),
                ANOMALIES_BOATBUMPER_ROV: getSubAnomalies("boatbumper", isROV),
                ANOMALIES_BOATBUMPER_DIVE: getSubAnomalies("boatbumper", isDiving),
                ANOMALIES_RBOATBUMPER: getSubAnomalies("boatbumper", isROV),
                ANOMALIES_DBOATBUMPER: getSubAnomalies("boatbumper", isDiving),
                ANOMALIES_BOATBUMPER_ABOVE: getSubAnomalies("boatbumper", isAboveWater),
                ANOMALIES_BOATBUMPER_UNDER: getSubAnomalies("boatbumper", isUnderwater),
                ANOMALIES_BOATBUMPER_ABOVE_WATER: getSubAnomalies("boatbumper", isAboveWater),
                ANOMALIES_BOATBUMPER_UNDERWATER: getSubAnomalies("boatbumper", isUnderwater),
                ANOMALIES_BOATBUMPER_TOP: getSubAnomalies("boatbumper", isAboveWater),
                ANOMALIES_BOATBUMPER_SUB: getSubAnomalies("boatbumper", isUnderwater),
                HAS_ANOMALIES_BOATBUMPER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatbumper")),
                HAS_ANOMALIES_BOATBUMPER_ROV: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatbumper") && isROV(a)),
                HAS_ANOMALIES_BOATBUMPER_DIVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatbumper") && isDiving(a)),
                HAS_ANOMALIES_RBOATBUMPER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatbumper") && isROV(a)),
                HAS_ANOMALIES_DBOATBUMPER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatbumper") && isDiving(a)),
                HAS_ANOMALIES_BOATBUMPER_ABOVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatbumper") && isAboveWater(a)),
                HAS_ANOMALIES_BOATBUMPER_UNDER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatbumper") && isUnderwater(a)),
                HAS_ANOMALIES_BOATBUMPER_ABOVE_WATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatbumper") && isAboveWater(a)),
                HAS_ANOMALIES_BOATBUMPER_UNDERWATER: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatbumper") && isUnderwater(a)),
                HAS_ANOMALIES_BOATBUMPER_TOP: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatbumper") && isAboveWater(a)),
                HAS_ANOMALIES_BOATBUMPER_SUB: rawAnomalies.some((a: any) => isItemMatchingSection(a, "boatbumper") && isUnderwater(a)),

                FINDINGS_BOATBUMPER: getSubFindings("boatbumper"),
                FINDINGS_BOATBUMPER_ROV: getSubFindings("boatbumper", isROV),
                FINDINGS_BOATBUMPER_DIVE: getSubFindings("boatbumper", isDiving),
                FINDINGS_RBOATBUMPER: getSubFindings("boatbumper", isROV),
                FINDINGS_DBOATBUMPER: getSubFindings("boatbumper", isDiving),
                FINDINGS_BOATBUMPER_ABOVE: getSubFindings("boatbumper", isAboveWater),
                FINDINGS_BOATBUMPER_UNDER: getSubFindings("boatbumper", isUnderwater),
                FINDINGS_BOATBUMPER_ABOVE_WATER: getSubFindings("boatbumper", isAboveWater),
                FINDINGS_BOATBUMPER_UNDERWATER: getSubFindings("boatbumper", isUnderwater),
                HAS_FINDINGS_BOATBUMPER: rawFindings.some((f: any) => isItemMatchingSection(f, "boatbumper")),
                HAS_FINDINGS_BOATBUMPER_ROV: rawFindings.some((f: any) => isItemMatchingSection(f, "boatbumper") && isROV(f)),
                HAS_FINDINGS_BOATBUMPER_DIVE: rawFindings.some((f: any) => isItemMatchingSection(f, "boatbumper") && isDiving(f)),
                HAS_FINDINGS_BOATBUMPER_ABOVE: rawFindings.some((f: any) => isItemMatchingSection(f, "boatbumper") && isAboveWater(f)),
                HAS_FINDINGS_BOATBUMPER_UNDER: rawFindings.some((f: any) => isItemMatchingSection(f, "boatbumper") && isUnderwater(f)),
                HAS_FINDINGS_BOATBUMPER_ABOVE_WATER: rawFindings.some((f: any) => isItemMatchingSection(f, "boatbumper") && isAboveWater(f)),
                HAS_FINDINGS_BOATBUMPER_UNDERWATER: rawFindings.some((f: any) => isItemMatchingSection(f, "boatbumper") && isUnderwater(f)),

                ANOMALIES_CP: getSubAnomalies("cp"),
                ANOMALIES_CP_ROV: getSubAnomalies("cp", isROV),
                ANOMALIES_CP_DIVE: getSubAnomalies("cp", isDiving),
                ANOMALIES_RCP: getSubAnomalies("cp", isROV),
                ANOMALIES_DCP: getSubAnomalies("cp", isDiving),
                HAS_ANOMALIES_CP: rawAnomalies.some((a: any) => isItemMatchingSection(a, "cp")),
                HAS_ANOMALIES_CP_ROV: rawAnomalies.some((a: any) => isItemMatchingSection(a, "cp") && isROV(a)),
                HAS_ANOMALIES_CP_DIVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "cp") && isDiving(a)),
                HAS_ANOMALIES_RCP: rawAnomalies.some((a: any) => isItemMatchingSection(a, "cp") && isROV(a)),
                HAS_ANOMALIES_DCP: rawAnomalies.some((a: any) => isItemMatchingSection(a, "cp") && isDiving(a)),

                FINDINGS_CP: getSubFindings("cp"),
                FINDINGS_CP_ROV: getSubFindings("cp", isROV),
                FINDINGS_CP_DIVE: getSubFindings("cp", isDiving),
                FINDINGS_RCP: getSubFindings("cp", isROV),
                FINDINGS_DCP: getSubFindings("cp", isDiving),
                HAS_FINDINGS_CP: rawFindings.some((f: any) => isItemMatchingSection(f, "cp")),
                HAS_FINDINGS_CP_ROV: rawFindings.some((f: any) => isItemMatchingSection(f, "cp") && isROV(f)),
                HAS_FINDINGS_CP_DIVE: rawFindings.some((f: any) => isItemMatchingSection(f, "cp") && isDiving(f)),

                ANOMALIES_FMD: getSubAnomalies("fmd"),
                ANOMALIES_FMD_ROV: getSubAnomalies("fmd", isROV),
                ANOMALIES_FMD_DIVE: getSubAnomalies("fmd", isDiving),
                ANOMALIES_RFMD: getSubAnomalies("fmd", isROV),
                ANOMALIES_DFMD: getSubAnomalies("fmd", isDiving),
                HAS_ANOMALIES_FMD: rawAnomalies.some((a: any) => isItemMatchingSection(a, "fmd")),
                HAS_ANOMALIES_FMD_ROV: rawAnomalies.some((a: any) => isItemMatchingSection(a, "fmd") && isROV(a)),
                HAS_ANOMALIES_FMD_DIVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "fmd") && isDiving(a)),
                HAS_ANOMALIES_RFMD: rawAnomalies.some((a: any) => isItemMatchingSection(a, "fmd") && isROV(a)),
                HAS_ANOMALIES_DFMD: rawAnomalies.some((a: any) => isItemMatchingSection(a, "fmd") && isDiving(a)),

                FINDINGS_FMD: getSubFindings("fmd"),
                FINDINGS_FMD_ROV: getSubFindings("fmd", isROV),
                FINDINGS_FMD_DIVE: getSubFindings("fmd", isDiving),
                FINDINGS_RFMD: getSubFindings("fmd", isROV),
                FINDINGS_DFMD: getSubFindings("fmd", isDiving),
                HAS_FINDINGS_FMD: rawFindings.some((f: any) => isItemMatchingSection(f, "fmd")),
                HAS_FINDINGS_FMD_ROV: rawFindings.some((f: any) => isItemMatchingSection(f, "fmd") && isROV(f)),
                HAS_FINDINGS_FMD_DIVE: rawFindings.some((f: any) => isItemMatchingSection(f, "fmd") && isDiving(f)),

                ANOMALIES_MGI: getSubAnomalies("mgi"),
                ANOMALIES_MGI_ROV: getSubAnomalies("mgi", isROV),
                ANOMALIES_MGI_DIVE: getSubAnomalies("mgi", isDiving),
                ANOMALIES_RMGI: getSubAnomalies("mgi", isROV),
                ANOMALIES_DMGI: getSubAnomalies("mgi", isDiving),
                HAS_ANOMALIES_MGI: rawAnomalies.some((a: any) => isItemMatchingSection(a, "mgi")),
                HAS_ANOMALIES_MGI_ROV: rawAnomalies.some((a: any) => isItemMatchingSection(a, "mgi") && isROV(a)),
                HAS_ANOMALIES_MGI_DIVE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "mgi") && isDiving(a)),
                HAS_ANOMALIES_RMGI: rawAnomalies.some((a: any) => isItemMatchingSection(a, "mgi") && isROV(a)),
                HAS_ANOMALIES_DMGI: rawAnomalies.some((a: any) => isItemMatchingSection(a, "mgi") && isDiving(a)),

                FINDINGS_MGI: getSubFindings("mgi"),
                FINDINGS_MGI_ROV: getSubFindings("mgi", isROV),
                FINDINGS_MGI_DIVE: getSubFindings("mgi", isDiving),
                FINDINGS_RMGI: getSubFindings("mgi", isROV),
                FINDINGS_DMGI: getSubFindings("mgi", isDiving),
                HAS_FINDINGS_MGI: rawFindings.some((f: any) => isItemMatchingSection(f, "mgi")),
                HAS_FINDINGS_MGI_ROV: rawFindings.some((f: any) => isItemMatchingSection(f, "mgi") && isROV(f)),
                HAS_FINDINGS_MGI_DIVE: rawFindings.some((f: any) => isItemMatchingSection(f, "mgi") && isDiving(f)),

                ANOMALIES_SCOUR: getSubAnomalies("scour"),
                HAS_ANOMALIES_SCOUR: rawAnomalies.some((a: any) => isItemMatchingSection(a, "scour")),
                FINDINGS_SCOUR: getSubFindings("scour"),
                HAS_FINDINGS_SCOUR: rawFindings.some((f: any) => isItemMatchingSection(f, "scour")),

                ANOMALIES_SEABED: getSubAnomalies("seabed"),
                HAS_ANOMALIES_SEABED: rawAnomalies.some((a: any) => isItemMatchingSection(a, "seabed")),
                FINDINGS_SEABED: getSubFindings("seabed"),
                HAS_FINDINGS_SEABED: rawFindings.some((f: any) => isItemMatchingSection(f, "seabed")),

                ANOMALIES_NODE: getSubAnomalies("node_cvi"),
                HAS_ANOMALIES_NODE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "node_cvi")),
                FINDINGS_NODE: getSubFindings("node_cvi"),
                HAS_FINDINGS_NODE: rawFindings.some((f: any) => isItemMatchingSection(f, "node_cvi")),

                ANOMALIES_SPLASHZONE: getSubAnomalies("splashzone"),
                HAS_ANOMALIES_SPLASHZONE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "splashzone")),
                FINDINGS_SPLASHZONE: getSubFindings("splashzone"),
                HAS_FINDINGS_SPLASHZONE: rawFindings.some((f: any) => isItemMatchingSection(f, "splashzone")),

                ANOMALIES_ANODE: getSubAnomalies("anode_gen"),
                HAS_ANOMALIES_ANODE: rawAnomalies.some((a: any) => isItemMatchingSection(a, "anode_gen") || isItemMatchingSection(a, "anode_sel")),
                FINDINGS_ANODE: getSubFindings("anode_gen"),
                HAS_FINDINGS_ANODE: rawFindings.some((f: any) => isItemMatchingSection(f, "anode_gen") || isItemMatchingSection(f, "anode_sel")),

                // ── Detailed Inspection Records / Table of Results per Sub-Section ──
                RECORDS_GVI: getSubRecords("gvi"),
                RECORDS_GVI_ROV: getSubRecords("gvi", isROV),
                RECORDS_GVI_DIVE: getSubRecords("gvi", isDiving),
                HAS_RECORDS_GVI: allRecords.some((r: any) => isItemMatchingSection(r, "gvi")),
                HAS_RECORDS_GVI_ROV: allRecords.some((r: any) => isItemMatchingSection(r, "gvi") && isROV(r)),
                HAS_RECORDS_GVI_DIVE: allRecords.some((r: any) => isItemMatchingSection(r, "gvi") && isDiving(r)),
                
                RECORDS_CP_ROV: getSubRecords("cp", isROV),
                RECORDS_CP_DIVE: getSubRecords("cp", isDiving),
                HAS_RECORDS_CP_ROV: allRecords.some((r: any) => isItemMatchingSection(r, "cp") && isROV(r)),
                HAS_RECORDS_CP_DIVE: allRecords.some((r: any) => isItemMatchingSection(r, "cp") && isDiving(r)),

                RECORDS_FMD: getSubRecords("fmd"),
                RECORDS_FMD_ROV: getSubRecords("fmd", isROV),
                RECORDS_FMD_DIVE: getSubRecords("fmd", isDiving),
                HAS_RECORDS_FMD: allRecords.some((r: any) => isItemMatchingSection(r, "fmd")),
                HAS_RECORDS_FMD_ROV: allRecords.some((r: any) => isItemMatchingSection(r, "fmd") && isROV(r)),
                HAS_RECORDS_FMD_DIVE: allRecords.some((r: any) => isItemMatchingSection(r, "fmd") && isDiving(r)),

                RECORDS_CAISSON: getSubRecords("caisson"),
                RECORDS_CAISSON_ROV: getSubRecords("caisson", isROV),
                RECORDS_CAISSON_DIVE: getSubRecords("caisson", isDiving),
                RECORDS_CAISSON_ABOVE_WATER: getSubRecords("caisson", isAboveWater),
                RECORDS_CAISSON_UNDERWATER: getSubRecords("caisson", isUnderwater),
                HAS_RECORDS_CAISSON: allRecords.some((r: any) => isItemMatchingSection(r, "caisson")),
                HAS_RECORDS_CAISSON_ROV: allRecords.some((r: any) => isItemMatchingSection(r, "caisson") && isROV(r)),
                HAS_RECORDS_CAISSON_DIVE: allRecords.some((r: any) => isItemMatchingSection(r, "caisson") && isDiving(r)),

                RECORDS_CAISSON_GUARD_ABOVE_WATER: getSubRecords("caissonguard_top", isAboveWater),
                RECORDS_CAISSON_GUARD_UNDERWATER: getSubRecords("caissonguard_sub", isUnderwater),
                RECORDS_CAISSON_GUARD_ROV: getSubRecords("caissonguard_sub", isROV),
                RECORDS_CAISSON_GUARD_DIVE: getSubRecords("caissonguard_sub", isDiving),
                HAS_RECORDS_CAISSON_GUARD_ABOVE_WATER: allRecords.some((r: any) => isItemMatchingSection(r, "caissonguard_top") && isAboveWater(r)),
                HAS_RECORDS_CAISSON_GUARD_UNDERWATER: allRecords.some((r: any) => isItemMatchingSection(r, "caissonguard_sub") && isUnderwater(r)),
                HAS_RECORDS_CAISSON_GUARD_ROV: allRecords.some((r: any) => isItemMatchingSection(r, "caissonguard_sub") && isROV(r)),
                HAS_RECORDS_CAISSON_GUARD_DIVE: allRecords.some((r: any) => isItemMatchingSection(r, "caissonguard_sub") && isDiving(r)),

                RECORDS_BOATLANDING_ABOVE_WATER: getSubRecords("boatlanding_top", isAboveWater),
                RECORDS_BOATLANDING_UNDERWATER: getSubRecords("boatlanding_sub", isUnderwater),
                RECORDS_BOATLANDING_ROV: getSubRecords("boatlanding_sub", isROV),
                RECORDS_BOATLANDING_DIVE: getSubRecords("boatlanding_sub", isDiving),
                HAS_RECORDS_BOATLANDING_ABOVE_WATER: allRecords.some((r: any) => isItemMatchingSection(r, "boatlanding_top") && isAboveWater(r)),
                HAS_RECORDS_BOATLANDING_UNDERWATER: allRecords.some((r: any) => isItemMatchingSection(r, "boatlanding_sub") && isUnderwater(r)),
                HAS_RECORDS_BOATLANDING_ROV: allRecords.some((r: any) => isItemMatchingSection(r, "boatlanding_sub") && isROV(r)),
                HAS_RECORDS_BOATLANDING_DIVE: allRecords.some((r: any) => isItemMatchingSection(r, "boatlanding_sub") && isDiving(r)),

                RECORDS_BOATBUMPER_ABOVE_WATER: getSubRecords("boatbumper_top", isAboveWater),
                RECORDS_BOATBUMPER_UNDERWATER: getSubRecords("boatbumper_sub", isUnderwater),
                RECORDS_BOATBUMPER_ROV: getSubRecords("boatbumper_sub", isROV),
                RECORDS_BOATBUMPER_DIVE: getSubRecords("boatbumper_sub", isDiving),
                HAS_RECORDS_BOATBUMPER_ABOVE_WATER: allRecords.some((r: any) => isItemMatchingSection(r, "boatbumper_top") && isAboveWater(r)),
                HAS_RECORDS_BOATBUMPER_UNDERWATER: allRecords.some((r: any) => isItemMatchingSection(r, "boatbumper_sub") && isUnderwater(r)),
                HAS_RECORDS_BOATBUMPER_ROV: allRecords.some((r: any) => isItemMatchingSection(r, "boatbumper_sub") && isROV(r)),
                HAS_RECORDS_BOATBUMPER_DIVE: allRecords.some((r: any) => isItemMatchingSection(r, "boatbumper_sub") && isDiving(r)),

                RECORDS_RISERGUARD_ABOVE_WATER: getSubRecords("riserguard_top", isAboveWater),
                RECORDS_RISERGUARD_UNDERWATER: getSubRecords("riserguard_sub", isUnderwater),
                RECORDS_RISERGUARD_ROV: getSubRecords("riserguard_sub", isROV),
                RECORDS_RISERGUARD_DIVE: getSubRecords("riserguard_sub", isDiving),
                HAS_RECORDS_RISERGUARD_ABOVE_WATER: allRecords.some((r: any) => isItemMatchingSection(r, "riserguard_top") && isAboveWater(r)),
                HAS_RECORDS_RISERGUARD_UNDERWATER: allRecords.some((r: any) => isItemMatchingSection(r, "riserguard_sub") && isUnderwater(r)),
                HAS_RECORDS_RISERGUARD_ROV: allRecords.some((r: any) => isItemMatchingSection(r, "riserguard_sub") && isROV(r)),
                HAS_RECORDS_RISERGUARD_DIVE: allRecords.some((r: any) => isItemMatchingSection(r, "riserguard_sub") && isDiving(r)),

                RECORDS_CONDUCTOR_ABOVE_WATER: getSubRecords("conductor_top", isAboveWater),
                RECORDS_CONDUCTOR_UNDERWATER: getSubRecords("conductor_sub", isUnderwater),
                RECORDS_CONDUCTOR_ROV: getSubRecords("conductor_sub", (r) => isUnderwater(r) && isROV(r)),
                RECORDS_CONDUCTOR_DIVE: getSubRecords("conductor_sub", (r) => isUnderwater(r) && isDiving(r)),
                HAS_RECORDS_CONDUCTOR_ABOVE_WATER: allRecords.some((r: any) => isItemMatchingSection(r, "conductor_top") && isAboveWater(r)),
                HAS_RECORDS_CONDUCTOR_ROV: allRecords.some((r: any) => isItemMatchingSection(r, "conductor_sub") && isUnderwater(r) && isROV(r)),
                HAS_RECORDS_CONDUCTOR_DIVE: allRecords.some((r: any) => isItemMatchingSection(r, "conductor_sub") && isUnderwater(r) && isDiving(r)),

                RECORDS_CONDUCTOR_GUARD_ABOVE_WATER: getSubRecords("conductorguard_top", isAboveWater),
                RECORDS_CONDUCTOR_GUARD_UNDERWATER: getSubRecords("conductorguard_sub", isUnderwater),
                RECORDS_CONDUCTOR_GUARD_ROV: getSubRecords("conductorguard_sub", isROV),
                RECORDS_CONDUCTOR_GUARD_DIVE: getSubRecords("conductorguard_sub", isDiving),
                HAS_RECORDS_CONDUCTOR_GUARD_ABOVE_WATER: allRecords.some((r: any) => isItemMatchingSection(r, "conductorguard_top") && isAboveWater(r)),
                HAS_RECORDS_CONDUCTOR_GUARD_UNDERWATER: allRecords.some((r: any) => isItemMatchingSection(r, "conductorguard_sub") && isUnderwater(r)),
                HAS_RECORDS_CONDUCTOR_GUARD_ROV: allRecords.some((r: any) => isItemMatchingSection(r, "conductorguard_sub") && isROV(r)),
                HAS_RECORDS_CONDUCTOR_GUARD_DIVE: allRecords.some((r: any) => isItemMatchingSection(r, "conductorguard_sub") && isDiving(r)),

                RECORDS_RISER_ABOVE_WATER: getSubRecords("riser", isAboveWater),
                RECORDS_RISER_UNDERWATER: getSubRecords("riser", isUnderwater),
                RECORDS_RISER_ROV: getSubRecords("riser", isROV),
                RECORDS_RISER_DIVE: getSubRecords("riser", isDiving),
                HAS_RECORDS_RISER_ABOVE_WATER: allRecords.some((r: any) => isItemMatchingSection(r, "riser") && isAboveWater(r)),
                HAS_RECORDS_RISER_ROV: allRecords.some((r: any) => isItemMatchingSection(r, "riser") && isROV(r)),
                HAS_RECORDS_RISER_DIVE: allRecords.some((r: any) => isItemMatchingSection(r, "riser") && isDiving(r)),

                RECORDS_SPLASHZONE: getSubRecords("splashzone"),
                HAS_RECORDS_SPLASHZONE: allRecords.some((r: any) => isItemMatchingSection(r, "splashzone")),
                RECORDS_ANODE_GEN: getSubRecords("anode_gen"),
                HAS_RECORDS_ANODE_GEN: allRecords.some((r: any) => isItemMatchingSection(r, "anode_gen")),
                RECORDS_ANODE_SEL: getSubRecords("anode_sel"),
                HAS_RECORDS_ANODE_SEL: allRecords.some((r: any) => isItemMatchingSection(r, "anode_sel")),

                RECORDS_MGI_DIVE: getSubRecords("mgi", isDiving),
                RECORDS_MGI_ROV: getSubRecords("mgi", isROV),
                HAS_RECORDS_MGI_DIVE: allRecords.some((r: any) => isItemMatchingSection(r, "mgi") && isDiving(r)),
                HAS_RECORDS_MGI_ROV: allRecords.some((r: any) => isItemMatchingSection(r, "mgi") && isROV(r)),

                RECORDS_SCOUR: getSubRecords("scour"),
                HAS_RECORDS_SCOUR: allRecords.some((r: any) => isItemMatchingSection(r, "scour")),
                RECORDS_DEBRIS: getSubRecords("seabed"),
                HAS_RECORDS_DEBRIS: allRecords.some((r: any) => isItemMatchingSection(r, "seabed")),
                RECORDS_SEABED: getSubRecords("seabed"),
                HAS_RECORDS_SEABED: allRecords.some((r: any) => isItemMatchingSection(r, "seabed")),

                FINDINGS: rawFindings,
                CP_RECORDS: insightData?.data?.cp_items || [],
                FMD_RECORDS: insightData?.data?.fmd_items || [],
                MGI_RECORDS: insightData?.data?.mgi_items || [],
                STATS: insightData?.data?.records || {},
                SOW_SUMMARY: insightData?.data?.sow_summary || [],
                HAS_SOW_SUMMARY: (insightData?.data?.sow_summary || []).length > 0,

                // ── Mapped Data from Inspection Records ──────────────
                ...mappedData,
            };

            // Automatically generate dynamically filtered lists inside reportData for type codes & defect codes
            rawAnomalies.forEach((item: any) => {
                const typeCode = String(item.inspection_type_code || "").trim().toUpperCase();
                if (typeCode) {
                    const key = `ANOMALIES_${typeCode}`;
                    if (!reportData[key]) {
                        reportData[key] = getFilteredAnomalies((x: any) => 
                            String(x.inspection_type_code || "").trim().toUpperCase() === typeCode
                        );
                    }
                }

                const defCode = String(item.defectCode || "").trim().toUpperCase().replace(/\s+/g, '_');
                if (defCode) {
                    const key = `ANOMALIES_CODE_${defCode}`;
                    if (!reportData[key]) {
                        reportData[key] = getFilteredAnomalies((x: any) => 
                            String(x.defectCode || "").trim().toUpperCase().replace(/\s+/g, '_') === defCode
                        );
                    }
                }
            });

            const { generateTemplateReport } = await import("@/utils/report-generators/template-report-generator");
            await generateTemplateReport({
                templateUrl: template.storage_path,
                data: reportData,
                fileName: `${str?.str_name || "Structure"}_Executive_Summary_${reportType}.docx`,
                logoUrl: companySettings?.data?.logo_url
            });

            toast.success("Report generated successfully");
        } catch (error: any) {
            console.error("Export error:", error);
            toast.error(error.message || "Error generating report");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAutoPopulate = () => {
        if (!insightData?.data) {
            toast.error("No inspection data available for auto-population");
            return;
        }

        const data = insightData.data;
        
        // Evaluate condition for the active section
        let selectedTemplateText = "";
        
        if (existingRules) {
            // Helper to check if a component type exists in the SOW
            const isComponentTypeRegistered = (codes: string[]) => {
                if (!data.componentSummary) return false;
                return Object.keys(data.componentSummary).some(compType => 
                    codes.some(c => compType.toUpperCase().includes(c.toUpperCase()))
                );
            };

            // Map sectionId to component codes
            const sectionComponentCodes: Record<string, string[]> = {
                cp: ["Anode", "Cathodic Protection", "AN", "CP"],
                fmd: ["Member", "Leg", "MB", "LG", "FMD"],
                mgi: ["Leg", "Member", "LG", "MB", "MGI", "Marine Growth"],
                scour: ["Pile", "Leg", "Scour", "SC"],
                gvi: ["Leg", "Member", "Riser", "Conductor", "Caisson", "Boat Landing", "Riser Guard"],
                riser: ["Riser", "RS"],
                conductor: ["Conductor", "CD"],
                caisson: ["Caisson", "CA"],
                boatlanding: ["Boat Landing", "BL"],
                riserguard: ["Riser Guard", "RG"]
            };

            const targetCodes = sectionComponentCodes[activeSectionId];
            const isRegistered = !targetCodes || isComponentTypeRegistered(targetCodes);

            // Determine condition
            if (!isRegistered) {
                selectedTemplateText = existingRules.cond_not_registered || "";
            } else {
                // Determine inspection count specific to section
                let sectionRecordsCount = 0;
                let sectionAnomaliesCount = 0;
                
                if (activeSectionId === "cp") {
                    sectionRecordsCount = data.cp?.totalCount || 0;
                    sectionAnomaliesCount = data.anomalies?.items?.filter((itm: any) => itm.description?.toLowerCase().includes("cp") || itm.ref?.toLowerCase().includes("cp")).length || 0;
                } else if (activeSectionId === "fmd") {
                    sectionRecordsCount = data.fmd?.total || 0;
                    sectionAnomaliesCount = data.anomalies?.items?.filter((itm: any) => itm.description?.toLowerCase().includes("fmd") || itm.description?.toLowerCase().includes("flood")).length || 0;
                } else if (activeSectionId === "mgi") {
                    sectionRecordsCount = data.mgi?.total || 0;
                    sectionAnomaliesCount = data.mgi?.anomaliesCount || 0;
                } else if (activeSectionId === "scour") {
                    sectionRecordsCount = data.scour?.total || 0;
                    sectionAnomaliesCount = data.anomalies?.items?.filter((itm: any) => itm.description?.toLowerCase().includes("scour") || itm.description?.toLowerCase().includes("burial")).length || 0;
                } else {
                    // Generic fallback: check if any records exist in the category
                    sectionRecordsCount = data.records?.total || 0;
                    sectionAnomaliesCount = data.anomalies?.total || 0;
                }

                if (sectionRecordsCount === 0) {
                    selectedTemplateText = existingRules.cond_no_inspection || "";
                } else if (sectionAnomaliesCount > 0) {
                    selectedTemplateText = existingRules.cond_has_anomaly || "";
                } else {
                    selectedTemplateText = existingRules.cond_has_data || "";
                }
            }
        }

        // If no custom template text matched/existed, fall back to default builder logic
        let wording = selectedTemplateText;
        if (!wording) {
            switch(activeSectionId) {
                case "intro":
                    const jp = jobpacks.find((j:any) => j.id.toString() === selections.jobpackId);
                    const str = structures.find((s:any) => s.id.toString() === selections.structureId);
                    wording = `This Executive Summary provides a comprehensive overview of the structural integrity inspection conducted for ${str?.str_name || 'the platform'} under Job Pack ${jp?.name || selections.jobpackId}. The scope of work was defined in SOW Report ${selections.sowReportNo}.`;
                    break;
                case "cp":
                    if (data.cp) {
                        const { minVal, maxVal, totalCount } = data.cp;
                        wording = `The Cathodic Potential (CP) survey was successfully conducted, with a total of ${totalCount} readings recorded. The measured potentials ranged from ${minVal || 'N/A'} mV to ${maxVal || 'N/A'} mV. Overall, the protection levels are [within/outside] acceptable criteria.`;
                    }
                    break;
                case "fmd":
                    if (data.fmd) {
                        const { total, conditions } = data.fmd;
                        wording = `Flooded Member Detection (FMD) was performed on ${total} members. Results identified ${conditions.flooded || 0} flooded members and ${conditions.dry || 0} dry members. ${conditions.inconclusive || 0} members returned inconclusive results.`;
                    }
                    break;
                case "mgi":
                    if (data.mgi) {
                        wording = `Marine Growth Inspection (MGI) was conducted across the structure. The maximum thickness recorded was ${data.mgi.max} mm, with an overall average of ${Math.round(data.mgi.avg)} mm. These values remain [within/above] the design thresholds.`;
                    }
                    break;
                case "scour":
                    if (data.scour) {
                        wording = `The Base Level / Scour Survey identified ${data.scour.exposed} exposed piles. The minimum burial recorded was ${data.scour.minBurial}%. Further monitoring is [recommended/not required].`;
                    }
                    break;
                case "anomaly_finding":
                    if (data.anomalies) {
                        const { total, open, byPriority } = data.anomalies;
                        wording = `A total of ${total} structural anomalies were tracked during this period. Currently, ${open} anomalies remain open. The breakdown by priority includes ${byPriority.P1 || 0} P1, ${byPriority.P2 || 0} P2, and ${byPriority.P3 || 0} P3 anomalies.`;
                    }
                    break;
                case "incomplete":
                    if (data.sow) {
                        const { incomplete, pending } = data.sow;
                        wording = `The current inspection scope has ${incomplete} items marked as incomplete and ${pending} items pending. These items are scheduled for follow-up in the next mobilization.`;
                    }
                    break;
                default:
                    wording = `The ${activeSection?.title} was completed successfully. Findings indicate that the structural components are in [Good/Fair/Poor] condition.`;
            }
        }

        // Apply variable databank replacements
        const jp = jobpacks.find((j:any) => j.id.toString() === selections.jobpackId);
        const str = structures.find((s:any) => s.id.toString() === selections.structureId);
        
        // Format dates cleanly
        const formatDateStr = (dStr: any) => {
            if (!dStr) return "N/A";
            return new Date(dStr).toLocaleDateString("en-GB");
        };

        const clientName = companySettings?.data?.company_name || jp?.metadata?.contrac || "[CLIENT]";
        const clientShort = (() => {
            const clientName = companySettings?.data?.company_name;
            if (!clientName) return "[CLIENT_SHORT]";
            const matched = contractors.find((c: any) => 
                String(c.lib_desc || "").toLowerCase().replace(/[^a-z0-9]/g, "") === 
                String(clientName).toLowerCase().replace(/[^a-z0-9]/g, "")
            );
            if (matched) return matched.lib_id || "[CLIENT_SHORT]";
            const partialMatch = contractors.find((c: any) => 
                String(c.lib_desc || "").toLowerCase().includes(String(clientName).toLowerCase()) ||
                String(clientName).toLowerCase().includes(String(c.lib_desc || "").toLowerCase())
            );
            return partialMatch?.lib_id || "[CLIENT_SHORT]";
        })();
        const contractorName = jp?.metadata?.contrac || "[CONTRACTOR]";
        const contractorShort = jp?.metadata?.contrac || "[CONTRACTOR_SHORT]";
        const fieldName = str?.field_name || "[FIELD_NAME]";
        
        const getTodayShort = () => {
            const d = new Date();
            const day = String(d.getDate()).padStart(2, '0');
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
        };

        const vars: Record<string, string> = {
            "{{PLATFORM}}": str?.str_name || "[PLATFORM]",
            "{{PLATFORM_TITLE}}": str?.str_name || "[PLATFORM]",
            "{{PLATFORM_NAME}}": str?.str_name || "[PLATFORM]",
            "{{JOB_PACK}}": jp?.name || "[JOB_PACK]",
            "{{JOB_PACK_NAME}}": jp?.name || "[JOB_PACK]",
            "{{REPORT_NO}}": selections.sowReportNo || "[REPORT_NO]",
            "{{SOW_REPORT_NO}}": selections.sowReportNo || "[REPORT_NO]",
            "{{CLIENT}}": clientName,
            "{{CLIENT_NAME}}": clientName,
            "{{CLIENT_NAME_UPPER}}": clientName.toUpperCase(),
            "{{CLIENT_SHORT}}": clientShort,
            "{{CLIENT_SHORT_UPPER}}": clientShort.toUpperCase(),
            "{{FIELD_NAME}}": fieldName,
            "{{OIL_FIELD}}": fieldName,
            "{{OIL_FIELD_NAME}}": fieldName,
            "{{CONTRACTOR}}": contractorName,
            "{{CONTRACTOR_NAME}}": contractorName,
            "{{CONTRACTOR_NAME_UPPER}}": contractorName.toUpperCase(),
            "{{CONTRACTOR_SHORT}}": contractorShort,
            "{{CONTRACTOR_SHORT_UPPER}}": contractorShort.toUpperCase(),
            "{{VESSEL_NAME}}": jp?.metadata?.vessel || "NONE",
            "{{START_DATE}}": formatDateStr(jp?.metadata?.istart || jp?.start_date),
            "{{INSP_START_DATE}}": formatDateStr(data.records?.startDate || jp?.metadata?.istart || jp?.start_date),
            "{{END_DATE}}": formatDateStr(jp?.metadata?.iend || jp?.end_date),
            "{{INSP_END_DATE}}": formatDateStr(data.records?.endDate || jp?.metadata?.iend || jp?.end_date),
            "{{DATE}}": new Date().toLocaleDateString("en-GB"),
            "{{TODAY_SHORT}}": getTodayShort(),
            "{{TOTAL_ANOMALIES}}": String(data.anomalies?.total || 0),
            "{{OPEN_ANOMALIES}}": String(data.anomalies?.open || 0),
            "{{P1_ANOMALIES}}": String(data.anomalies?.byPriority?.P1 || 0),
            "{{P2_ANOMALIES}}": String(data.anomalies?.byPriority?.P2 || 0),
            "{{P3_ANOMALIES}}": String(data.anomalies?.byPriority?.P3 || 0),
            "{{CP_MIN}}": data.cp?.minVal != null ? `${data.cp.minVal} mV` : "N/A",
            "{{CP_MAX}}": data.cp?.maxVal != null ? `${data.cp.maxVal} mV` : "N/A",
            "{{MGI_MIN}}": data.mgi?.min != null ? `${data.mgi.min} mm` : "0 mm",
            "{{MGI_MIN_COMP}}": data.mgi?.minComp || "N/A",
            "{{MGI_MAX}}": data.mgi?.max != null ? `${data.mgi.max} mm` : "0 mm",
            "{{MGI_MAX_COMP}}": data.mgi?.maxComp || "N/A",
            "{{MGI_HARD_MIN_PCT}}": data.mgi?.hardMinPct != null ? `${data.mgi.hardMinPct}%` : "0%",
            "{{MGI_HARD_MIN_PCT_COMP}}": data.mgi?.hardMinPctComp || "N/A",
            "{{MGI_HARD_MAX_PCT}}": data.mgi?.hardMaxPct != null ? `${data.mgi.hardMaxPct}%` : "0%",
            "{{MGI_HARD_MAX_PCT_COMP}}": data.mgi?.hardMaxPctComp || "N/A",
            "{{MGI_SOFT_MIN_PCT}}": data.mgi?.softMinPct != null ? `${data.mgi.softMinPct}%` : "0%",
            "{{MGI_SOFT_MIN_PCT_COMP}}": data.mgi?.softMinPctComp || "N/A",
            "{{MGI_SOFT_MAX_PCT}}": data.mgi?.softMaxPct != null ? `${data.mgi.softMaxPct}%` : "0%",
            "{{MGI_SOFT_MAX_PCT_COMP}}": data.mgi?.softMaxPctComp || "N/A",
            "{{SCOUR_MAX_DEPTH}}": data.scour?.maxDepth != null ? `${data.scour.maxDepth} m` : "0 m",
            "{{SCOUR_MAX_LEG}}": data.scour?.maxDepthLocation || data.scour?.maxDepthLeg || "N/A",
            "{{SCOUR_MAX_LOCATION}}": data.scour?.maxDepthLocation || data.scour?.maxDepthLeg || "N/A",
            "{{SCOUR_MAX_FACE}}": data.scour?.maxDepthFace || "N/A",
            "{{SCOUR_MAX_QID}}": data.scour?.maxDepthQid || "N/A",
            "{{SCOUR_EXPOSED_LOCATIONS}}": data.scour?.exposedLocationsStr || "None",
            "{{MGI_ANOMALIES}}": String(data.mgi?.anomaliesCount || 0)
        };

        // Inject Custom Variables
        Object.entries(customVariables).forEach(([k, v]) => {
            vars[`{{${k.toUpperCase()}}}`] = String(v);
        });

        // Replace all placeholders
        let finalWording = wording;
        Object.entries(vars).forEach(([k, v]) => {
            finalWording = finalWording.replaceAll(k, v);
        });

        setSectionsData(prev => ({ ...prev, [activeSectionId]: finalWording }));
        toast.info(`Auto-populated ${activeSection?.title}`);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/50">
            {/* Header / Context Selection */}
            <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-2 rounded-lg text-white shadow-blue-500/20 shadow-lg">
                        <FileText className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Executive Summary Builder</h1>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Reports & Aggregates</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Tabs value={reportType} onValueChange={setReportType} className="w-[200px]">
                        <TabsList className="grid w-full grid-cols-2 h-9">
                            <TabsTrigger value="preliminary" className="text-[10px] uppercase font-bold">Prelim</TabsTrigger>
                            <TabsTrigger value="final" className="text-[10px] uppercase font-bold">Final</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <div className="flex items-center gap-2">
                        <SearchableSelect 
                            options={structures.map((s: any) => ({ value: s.id.toString(), label: s.str_name }))}
                            value={selections.structureId}
                            onValueChange={(v) => setSelections({ structureId: v, jobpackId: "", sowReportNo: "" })}
                            placeholder="Select Structure"
                            searchPlaceholder="Search Structure..."
                            className="w-[240px]"
                        />

                        <SearchableSelect 
                            options={filteredJobpacks.map((jp: any) => ({ value: jp.id.toString(), label: jp.name || jp.id }))}
                            value={selections.jobpackId}
                            onValueChange={(v) => setSelections(s => ({...s, jobpackId: v, sowReportNo: "" }))}
                            disabled={!selections.structureId}
                            placeholder="Select Job Pack"
                            searchPlaceholder="Search Job Pack..."
                            className="w-[240px]"
                        />

                        <SearchableSelect 
                            options={availableSowReports.map((no: string) => ({ value: no, label: no }))}
                            value={selections.sowReportNo}
                            onValueChange={(v) => setSelections(s => ({...s, sowReportNo: v}))}
                            disabled={!selections.jobpackId}
                            placeholder="SOW Report No"
                            searchPlaceholder="Search Report No..."
                            className="w-[180px]"
                        />
                    </div>

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    <Button variant="outline" size="sm" onClick={() => setIsAnalyticsOpen(true)} disabled={!selections.sowReportNo} className="gap-2 h-9 border-blue-200 text-blue-700 hover:bg-blue-50">
                        <BarChart3 className="h-4 w-4" />
                        <span className="hidden xl:inline">Live Analytics</span>
                    </Button>

                    <Button variant="outline" size="icon" onClick={() => setIsSettingsOpen(true)} className="h-9 w-9">
                        <Settings className="h-4 w-4" />
                    </Button>

                    <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving || !selections.sowReportNo} className="gap-2 h-9">
                        {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        <span className="hidden lg:inline">Save</span>
                    </Button>

                    <Button 
                        variant="default" 
                        size="sm" 
                        onClick={handleExportDocx} 
                        disabled={isGenerating || !selections.sowReportNo}
                        className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 gap-2 h-9 min-w-[120px]"
                    >
                        {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {reportType === "final" ? "Final DOCX" : "Prelim DOCX"}
                    </Button>
                </div>
            </header>

            <div className="flex grow overflow-hidden">
                {/* TOC Sidebar */}
                <aside className="w-80 bg-white dark:bg-slate-900 border-r flex flex-col">
                    <div className="p-4 border-b flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">Table of Contents</h2>
                        <LayoutList className="h-4 w-4 text-slate-400" />
                    </div>
                    <ScrollArea className="grow">
                        <div className="p-2 space-y-1">
                            {EXECUTIVE_SUMMARY_TOC.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSectionId(section.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group
                                        ${activeSectionId === section.id 
                                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold shadow-sm" 
                                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"}
                                    `}
                                >
                                    {sectionsData[section.id] ? (
                                        <CheckCircle2 className={`h-4 w-4 ${activeSectionId === section.id ? "text-blue-600" : "text-emerald-500"}`} />
                                    ) : (
                                        <Circle className="h-4 w-4 text-slate-300 dark:text-slate-700" />
                                    )}
                                    <span className="truncate">{section.title}</span>
                                    <ChevronRight className={`ml-auto h-3.5 w-3.5 transition-transform ${activeSectionId === section.id ? "translate-x-0" : "opacity-0 group-hover:opacity-100 -translate-x-1"}`} />
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </aside>

                {/* Main Content Editor */}
                <main className="grow flex flex-col bg-white dark:bg-slate-900 m-4 rounded-2xl border shadow-sm overflow-hidden">
                    {!selections.sowReportNo ? (
                        <div className="grow flex flex-col items-center justify-center text-center p-8 space-y-4">
                            <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full">
                                <Database className="h-10 w-10 text-slate-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">Select Report Context</h3>
                                <p className="text-slate-500 max-w-sm">Please select a Job Pack, Structure, and SOW Report No to begin building the executive summary.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/30">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{activeSection?.title}</h2>
                                    <p className="text-xs text-slate-500">Section Summary and Findings</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setIsTemplatesOpen(true)} className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
                                        <BookOpen className="h-3.5 w-3.5" />
                                        Templates
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={handleAutoPopulate} className="gap-2 border-dashed">
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Auto-populate
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setShowInsight(!showInsight)} className={showInsight ? "text-blue-600 bg-blue-50 dark:bg-blue-900/30" : ""}>
                                        <PanelRightOpen className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="grow p-6 flex flex-col">
                                <Label className="mb-2 text-slate-500 font-medium">Summary Content</Label>
                                <Textarea
                                    value={sectionsData[activeSectionId] || ""}
                                    onChange={(e) => setSectionsData(prev => ({ ...prev, [activeSectionId]: e.target.value }))}
                                    placeholder={`Enter summary for ${activeSection?.title}...`}
                                    className="grow resize-none text-base p-4 focus-visible:ring-blue-500 border-slate-200 dark:border-slate-800"
                                />
                                <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <Info className="h-3.5 w-3.5" />
                                        <span>Use the right panel to pull specific inspection metrics.</span>
                                    </div>
                                    <span>Character count: {sectionsData[activeSectionId]?.length || 0}</span>
                                </div>
                            </div>
                        </>
                    )}
                </main>

                {/* Insight Panel (Right) */}
                <AnimatePresence>
                    {showInsight && (
                        <motion.aside
                            initial={{ x: 400, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: 400, opacity: 0 }}
                            className="w-96 bg-white dark:bg-slate-900 border-l shadow-2xl flex flex-col z-20"
                        >
                            <div className="p-4 border-b flex items-center justify-between bg-blue-600 text-white">
                                <div className="flex items-center gap-2">
                                    <Database className="h-4 w-4" />
                                    <h2 className="text-sm font-bold uppercase tracking-wider">Live Inspection Data</h2>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setShowInsight(false)} className="text-white hover:bg-blue-700 h-7 w-7">
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>

                            <ScrollArea className="grow">
                                <div className="p-4 space-y-6">
                                    {isLoadingInsight ? (
                                        <div className="flex flex-col items-center justify-center h-40 space-y-3">
                                            <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
                                            <p className="text-xs text-slate-500">Aggregating inspection data...</p>
                                        </div>
                                    ) : !insightData?.data ? (
                                        <div className="text-center py-10">
                                            <p className="text-sm text-slate-500">No live data found for this context.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {/* Metrics Cards based on activeSectionId */}
                                            {activeSectionId === "cp" && insightData.data.cp && (
                                                <Card className="border-blue-100 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-900/10">
                                                    <CardHeader className="p-4 pb-2">
                                                        <CardTitle className="text-sm">CP Survey Stats</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="p-4 pt-0 space-y-3">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="bg-white dark:bg-slate-900 p-2 rounded border text-center">
                                                                <p className="text-[10px] text-slate-500 uppercase">Min mV</p>
                                                                <p className="text-lg font-bold text-blue-600">{insightData.data.cp.minVal || '-'}</p>
                                                            </div>
                                                            <div className="bg-white dark:bg-slate-900 p-2 rounded border text-center">
                                                                <p className="text-[10px] text-slate-500 uppercase">Max mV</p>
                                                                <p className="text-lg font-bold text-blue-600">{insightData.data.cp.maxVal || '-'}</p>
                                                            </div>
                                                        </div>
                                                        <Button variant="secondary" size="sm" className="w-full h-8 text-xs gap-2" 
                                                            onClick={() => {
                                                                const s = `Measured potentials: ${insightData.data.cp.minVal} mV to ${insightData.data.cp.maxVal} mV (Total: ${insightData.data.cp.totalCount} readings).`;
                                                                setSectionsData(prev => ({ ...prev, [activeSectionId]: (prev[activeSectionId] || "") + " " + s }));
                                                            }}
                                                        >
                                                            <Copy className="h-3 w-3" /> Append to Summary
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {activeSectionId === "fmd" && insightData.data.fmd && (
                                                <Card className="border-amber-100 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10">
                                                    <CardHeader className="p-4 pb-2">
                                                        <CardTitle className="text-sm">FMD Findings</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="p-4 pt-0 space-y-3">
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex justify-between"><span>Flooded</span><span className="font-bold text-red-500">{insightData.data.fmd.conditions.flooded}</span></div>
                                                            <div className="flex justify-between"><span>Dry</span><span className="font-bold text-emerald-500">{insightData.data.fmd.conditions.dry}</span></div>
                                                            <div className="flex justify-between"><span>Inconclusive</span><span className="font-bold text-slate-500">{insightData.data.fmd.conditions.inconclusive}</span></div>
                                                        </div>
                                                        <Button variant="secondary" size="sm" className="w-full h-8 text-xs gap-2"
                                                            onClick={() => {
                                                                const s = `FMD Results: ${insightData.data.fmd.conditions.flooded} Flooded, ${insightData.data.fmd.conditions.dry} Dry.`;
                                                                setSectionsData(prev => ({ ...prev, [activeSectionId]: (prev[activeSectionId] || "") + " " + s }));
                                                            }}
                                                        >
                                                            <Copy className="h-3 w-3" /> Append to Summary
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            {/* Common Stats */}
                                            <div className="space-y-4">
                                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Scope Overview</h3>
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50">
                                                        <div className="flex items-center gap-3">
                                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                            <span className="text-xs font-medium">Completion</span>
                                                        </div>
                                                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{insightData.data.sow.completionPct}%</Badge>
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50">
                                                        <div className="flex items-center gap-3">
                                                            <Info className="h-4 w-4 text-blue-500" />
                                                            <span className="text-xs font-medium">Total Records</span>
                                                        </div>
                                                        <span className="text-xs font-bold">{insightData.data.records.total}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </motion.aside>
                    )}
                </AnimatePresence>
            </div>

            <ReportSettingsDialog 
                open={isSettingsOpen} 
                onOpenChange={setIsSettingsOpen} 
            />

            <SummaryTemplatesDialog 
                open={isTemplatesOpen}
                onOpenChange={setIsTemplatesOpen}
                sectionId={activeSectionId}
                sectionTitle={activeSection?.title || ""}
                currentContent={sectionsData[activeSectionId] || ""}
                onSelect={(content) => setSectionsData(prev => ({ ...prev, [activeSectionId]: content }))}
                projectContext={{
                    platform: structures.find(s => s.id.toString() === selections.structureId)?.str_name,
                    jobpack: jobpacks.find(j => j.id.toString() === selections.jobpackId)?.name,
                    reportNo: selections.sowReportNo,
                    client: companySettings?.data?.company_name,
                    clientShort: (() => {
                        const clientName = companySettings?.data?.company_name;
                        if (!clientName) return "N/A";
                        const matched = contractors.find((c: any) => 
                            String(c.lib_desc || "").toLowerCase().replace(/[^a-z0-9]/g, "") === 
                            String(clientName).toLowerCase().replace(/[^a-z0-9]/g, "")
                        );
                        if (matched) return matched.lib_id || "N/A";
                        const partialMatch = contractors.find((c: any) => 
                            String(c.lib_desc || "").toLowerCase().includes(String(clientName).toLowerCase()) ||
                            String(clientName).toLowerCase().includes(String(c.lib_desc || "").toLowerCase())
                        );
                        return partialMatch?.lib_id || "N/A";
                    })(),
                    contractor: jobpacks.find(j => j.id.toString() === selections.jobpackId)?.metadata?.contrac || "N/A",
                    vessel: jobpacks.find(j => j.id.toString() === selections.jobpackId)?.metadata?.vessel || "NONE",
                    fieldName: structures.find(s => s.id.toString() === selections.structureId)?.field_name || "N/A",
                    startDate: (() => {
                        const jp = jobpacks.find(j => j.id.toString() === selections.jobpackId);
                        const dateStr = jp?.metadata?.istart || jp?.start_date;
                        if (!dateStr) return "N/A";
                        return new Date(dateStr).toLocaleDateString("en-GB");
                    })(),
                    endDate: (() => {
                        const jp = jobpacks.find(j => j.id.toString() === selections.jobpackId);
                        const dateStr = jp?.metadata?.iend || jp?.end_date;
                        if (!dateStr) return "N/A";
                        return new Date(dateStr).toLocaleDateString("en-GB");
                    })()
                }}
                existingRules={existingRules}
                onSaveRules={async (rules) => {
                    await handleSaveRules(rules);
                    refreshSectionTemplates();
                }}
                customVariables={customVariables}
                onSaveCustomVariables={handleSaveCustomVariables}
            />

            <InspectionAnalyticsDialog
                open={isAnalyticsOpen}
                onOpenChange={setIsAnalyticsOpen}
                insightData={insightData}
                projectContext={{
                    platform: structures.find(s => s.id.toString() === selections.structureId)?.str_name,
                    jobpack: jobpacks.find(j => j.id.toString() === selections.jobpackId)?.name,
                    reportNo: selections.sowReportNo,
                    vessel: jobpacks.find(j => j.id.toString() === selections.jobpackId)?.metadata?.vessel
                }}
            />
        </div>
    );
}
