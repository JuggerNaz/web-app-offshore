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
    BookOpen
} from "lucide-react";
import { SummaryTemplatesDialog } from "./SummaryTemplatesDialog";
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
    const { data: sowsData } = useSWR(
        selections.jobpackId && selections.structureId 
            ? `/api/sow?jobpack_id=${selections.jobpackId}&structure_id=${selections.structureId}` 
            : null, 
        fetcher
    );

    const jobpacks = useMemo(() => {
        return [...(jobpacksData?.data || [])].sort((a, b) => 
            (a.name || "").localeCompare(b.name || "", undefined, { numeric: true })
        );
    }, [jobpacksData]);

    const { data: sowsForJobpackData } = useSWR(
        selections.jobpackId ? `/api/sow?jobpack_id=${selections.jobpackId}` : null,
        fetcher
    );

    const filteredStructures = useMemo(() => {
        if (!selections.jobpackId || !sowsForJobpackData?.data || !Array.isArray(sowsForJobpackData.data)) return [];
        
        // Extract unique structures from SOWs
        const uniqueMap = new Map();
        sowsForJobpackData.data.forEach((sow: any) => {
            if (sow && sow.structure_id && !uniqueMap.has(sow.structure_id)) {
                uniqueMap.set(sow.structure_id, {
                    id: sow.structure_id,
                    name: sow.structure_title || `Structure ${sow.structure_id}`
                });
            }
        });

        return Array.from(uniqueMap.values()).sort((a, b) => 
            a.name.localeCompare(b.name, undefined, { numeric: true })
        );
    }, [selections.jobpackId, sowsForJobpackData]);

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
        const str = filteredStructures.find((s:any) => s.id.toString() === selections.structureId);
        
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
            
            const sections = EXECUTIVE_SUMMARY_TOC.map(s => {
                const sectionData: any = {
                    id: s.id,
                    title: s.title,
                    content: sectionsData[s.id] || ""
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

            // Fetch Detailed Records
            const recordsRes = await fetch(`/api/inspection-records?jobpack_id=${selections.jobpackId}&structure_id=${selections.structureId}&sow_report_no=${selections.sowReportNo}`);
            if (!recordsRes.ok) {
                const errText = await recordsRes.text();
                throw new Error(`Failed to fetch inspection records: ${recordsRes.status} ${recordsRes.statusText}`);
            }
            const recordsData = await recordsRes.json();
            const allRecords = Array.isArray(recordsData?.data) ? recordsData.data : [];

            // Map data for DOCX
            const mappedData = await mapInspectionDataForDocx(allRecords, aliases);

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

            const reportData = {
                // ── Core Project Identifiers ─────────────────────────
                PLATFORM_TITLE: str?.name || "N/A",
                PLATFORM_NAME: str?.name || "N/A",
                JOB_PACK_NAME: jp?.name || "N/A",
                REPORT_NO: selections.sowReportNo,
                SOW_REPORT_NO: selections.sowReportNo,
                REPORT_TYPE: reportType.toUpperCase(),
                DATE: new Date().toLocaleDateString("en-GB"),

                // ── Company / Client Info ────────────────────────────
                CLIENT_NAME: companySettings?.data?.company_name || jp?.metadata?.contrac || "N/A",
                DEPARTMENT: companySettings?.data?.department_name || "N/A",
                PROJECT_NAME: companySettings?.data?.project_name || "N/A",

                // ── Job Pack Metadata ────────────────────────────────
                VESSEL_NAME: jp?.metadata?.vessel || "NONE",
                PROJECT_NO: jp?.metadata?.inspno || jp?.project_no || "N/A",
                CONTRACTOR: jp?.metadata?.contrac || "N/A",
                START_DATE: jp?.metadata?.istart ? new Date(jp.metadata.istart).toLocaleDateString("en-GB") : (jp?.start_date || "N/A"),
                END_DATE: jp?.metadata?.iend ? new Date(jp.metadata.iend).toLocaleDateString("en-GB") : (jp?.end_date || "N/A"),

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
                MGI_MAX: insightData?.data?.mgi?.max || 0,
                MGI_AVG: Math.round(insightData?.data?.mgi?.avg || 0),
                SCOUR_EXPOSED: insightData?.data?.scour?.exposed || 0,

                // ── Sections (User-Written) ──────────────────────────
                SECTIONS: sections,

                // ── Detailed Loop Tables ─────────────────────────────
                ANOMALIES: insightData?.data?.anomalies?.items || [],
                FINDINGS: insightData?.data?.findings?.items || [],
                CP_RECORDS: insightData?.data?.cp_items || [],
                FMD_RECORDS: insightData?.data?.fmd_items || [],
                MGI_RECORDS: insightData?.data?.mgi_items || [],
                STATS: insightData?.data?.records || {},

                // ── Mapped Data from Inspection Records ──────────────
                ...mappedData,
            };

            const { generateTemplateReport } = await import("@/utils/report-generators/template-report-generator");
            await generateTemplateReport({
                templateUrl: template.storage_path,
                data: reportData,
                fileName: `${str?.name}_Executive_Summary_${reportType}.docx`,
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
        let wording = "";

        switch(activeSectionId) {
            case "intro":
                const jp = jobpacks.find((j:any) => j.id.toString() === selections.jobpackId);
                const str = filteredStructures.find((s:any) => s.id.toString() === selections.structureId);
                wording = `This Executive Summary provides a comprehensive overview of the structural integrity inspection conducted for ${str?.name || 'the platform'} under Job Pack ${jp?.name || selections.jobpackId}. The scope of work was defined in SOW Report ${selections.sowReportNo}.`;
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

        setSectionsData(prev => ({ ...prev, [activeSectionId]: wording }));
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
                            options={jobpacks.map((jp: any) => ({ value: jp.id.toString(), label: jp.name || jp.id }))}
                            value={selections.jobpackId}
                            onValueChange={(v) => setSelections({ jobpackId: v, structureId: "", sowReportNo: "" })}
                            placeholder="Select Job Pack"
                            searchPlaceholder="Search Job Pack..."
                            className="w-[240px]"
                        />

                        <SearchableSelect 
                            options={filteredStructures.map((s: any) => ({ value: s.id.toString(), label: s.name }))}
                            value={selections.structureId}
                            onValueChange={(v) => setSelections(s => ({...s, structureId: v, sowReportNo: "" }))}
                            disabled={!selections.jobpackId}
                            placeholder="Select Structure"
                            searchPlaceholder="Search Structure..."
                            className="w-[240px]"
                        />

                        <SearchableSelect 
                            options={availableSowReports.map((no: string) => ({ value: no, label: no }))}
                            value={selections.sowReportNo}
                            onValueChange={(v) => setSelections(s => ({...s, sowReportNo: v}))}
                            disabled={!selections.structureId}
                            placeholder="SOW Report No"
                            searchPlaceholder="Search Report No..."
                            className="w-[180px]"
                        />
                    </div>

                    <Separator orientation="vertical" className="h-6 mx-1" />

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
                    platform: filteredStructures.find(s => s.id.toString() === selections.structureId)?.name,
                    jobpack: jobpacks.find(j => j.id.toString() === selections.jobpackId)?.name,
                    reportNo: selections.sowReportNo,
                    client: companySettings?.data?.company_name
                }}
            />
        </div>
    );
}
