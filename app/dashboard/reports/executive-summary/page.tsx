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
import { SummaryTemplatesDialog } from "./SummaryTemplatesDialog";
import { InspectionAnalyticsDialog } from "./InspectionAnalyticsDialog";
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
import { EXECUTIVE_SUMMARY_TOC } from "./constants";
import { SearchableSelect } from "./SearchableSelect";
import { ReportSettingsDialog } from "./ReportSettingsDialog";
import { generateTemplateReport } from "@/utils/report-generators/template-report-generator";
import { mapInspectionDataForDocx, generateMgiProfileImage, generateSeabedMapImage } from "@/utils/report-generators/report-data-mapper";

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
    const { data: jobpacksData } = useSWR("/api/jobpack?has_inspection=true", fetcher);
    const { data: companySettings } = useSWR("/api/company-settings", fetcher);
    const { data: templatesRes } = useSWR("/api/report-templates", fetcher);
    const { data: structuresRes } = useSWR("/api/structures", fetcher);
    const { data: sowsData } = useSWR(
        selections.jobpackId && selections.structureId 
            ? `/api/sow?jobpack_id=${selections.jobpackId}&structure_id=${selections.structureId}` 
            : null, 
        fetcher
    );
    const { data: contractorsRes } = useSWR("/api/jobpack/utils/contractors", fetcher);
    const contractors = useMemo(() => contractorsRes?.data || [], [contractorsRes]);

    const jobpacks = useMemo(() => {
        return [...(jobpacksData?.data || [])].sort((a, b) => 
            (a.name || "").localeCompare(b.name || "", undefined, { numeric: true })
        );
    }, [jobpacksData]);

    const structures = useMemo(() => {
        return [...(structuresRes?.data || [])].sort((a, b) => 
            (a.str_name || "").localeCompare(b.str_name || "", undefined, { numeric: true })
        );
    }, [structuresRes]);

    const { data: sowsForStructureData } = useSWR(
        selections.structureId ? `/api/sow?structure_id=${selections.structureId}` : null,
        fetcher
    );

    const filteredJobpacks = useMemo(() => {
        if (!selections.structureId || !sowsForStructureData?.data || !Array.isArray(sowsForStructureData.data)) return [];
        
        const jobpackIds = new Set(sowsForStructureData.data.map((sow: any) => Number(sow.jobpack_id)));
        
        return jobpacks.filter((jp: any) => jobpackIds.has(Number(jp.id)));
    }, [selections.structureId, sowsForStructureData, jobpacks]);

    const availableSowReports = useMemo(() => {
        if (!sowsData?.data || typeof sowsData.data !== 'object') return [];
        const reportNumbers = sowsData.data.report_numbers;
        if (!Array.isArray(reportNumbers)) return [];
        
        const reports = reportNumbers.map((r: any) => r.number || r) || [];
        return [...reports].sort((a, b) => 
            String(a).localeCompare(String(b), undefined, { numeric: true })
        );
    }, [sowsData]);

    // Fetch existing summary
    const { data: summaryData, mutate: refreshSummary } = useSWR(
        selections.jobpackId && selections.structureId && selections.sowReportNo
            ? `/api/executive-summary?jobpack_id=${selections.jobpackId}&structure_id=${selections.structureId}&sow_report_no=${selections.sowReportNo}`
            : null,
        fetcher
    );

    // Fetch insight data (Live stats)
    const { data: insightData, isLoading: isLoadingInsight } = useSWR(
        selections.jobpackId && selections.structureId && selections.sowReportNo
            ? `/api/inspection-summary?jobpack_id=${selections.jobpackId}&structure_id=${selections.structureId}&sow_report_no=${selections.sowReportNo}`
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
        if (!selections.jobpackId || !selections.structureId || !selections.sowReportNo) return;
        
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
                structure_id: Number(selections.structureId),
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
        if (!selections.jobpackId || !selections.structureId || !selections.sowReportNo) return;
        
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
                    structure_id: Number(selections.structureId),
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
            const { mapInspectionDataForDocx, generateMgiProfileImage } = await import("@/utils/report-generators/report-data-mapper");
            
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
            let aliases = [];
            if (aliasesRes.ok) {
                const aliasesData = await aliasesRes.json();
                aliases = Array.isArray(aliasesData?.data) ? aliasesData.data : [];
            }

            // Fetch Contractors
            const contractorsRes = await fetch("/api/jobpack/utils/contractors");
            let contractors = [];
            if (contractorsRes.ok) {
                const contrData = await contractorsRes.json();
                contractors = Array.isArray(contrData?.data) ? contrData.data : [];
            }
            const activeContractor = contractors.find((c: any) => String(c.lib_id) === String(jp?.metadata?.contrac));

            // Fetch Detailed Records
            const recordsRes = await fetch(`/api/inspection-records?jobpack_id=${selections.jobpackId}&structure_id=${selections.structureId}&sow_report_no=${selections.sowReportNo}`);
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
                const apiRes = await fetch(`/api/attachment/${sourceType}/${selections.structureId}`);
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
            let priorityColors: Record<string, string> = {
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

                return {
                    ...item,
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
            const rawFindings = insightData?.data?.findings?.items || [];
            const obsFindings = rawFindings.filter(getPriorityFilter("OBS"));
            const p1Findings = rawFindings.filter(getPriorityFilter("P1"));
            const p2Findings = rawFindings.filter(getPriorityFilter("P2"));
            const p3Findings = rawFindings.filter(getPriorityFilter("P3"));

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

            const reportData: Record<string, any> = {
                STRUCTURE_VISUALS: structureVisuals,
                HAS_VISUALS: structureVisuals.length > 0,
                HAS_ANOMALIES: totalAnomCount > 0,
                HAS_FINDINGS: totalFindingsCount > 0,

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
                    const modes = [];
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
                    const scopes = [];
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
                RECTIFIED_ANOMALIES: insightData?.data?.anomalies?.rectified || 0,
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
                SECTIONS: sections,
                NEXT_PARAGRAPH_NO: `1.${sections.length + 1}`,
                NEXT_NO: sections.length + 1,
                HAS_OUTSTANDING_TASKS: (insightData?.data?.outstanding_tasks || []).length > 0,
                NO_OUTSTANDING_TASKS: (insightData?.data?.outstanding_tasks || []).length === 0,
                OUTSTANDING_TASKS: (insightData?.data?.outstanding_tasks || []).map((t: any, idx: number) => ({
                    ...t,
                    no: idx + 1
                })),
                OUTSTANDING_GROUPS: (() => {
                    const groupsMap = new Map<string, any[]>();
                    (insightData?.data?.outstanding_tasks || []).forEach((t: any) => {
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
                FINDINGS: insightData?.data?.findings?.items || [],
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
