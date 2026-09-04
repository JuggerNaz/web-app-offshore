import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
    Activity, 
    ArrowLeft, 
    Printer, 
    Settings, 
    FileSpreadsheet, 
    Layout,
    History,
    ChevronDown,
    Check,
    Grid3X3,
    BarChart3,
    Compass,
    Layers,
    ArrowRightLeft,
    LayoutGrid,
    RotateCcw,
    Edit2,
    Globe
} from "lucide-react";
import Link from 'next/link';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { VoiceInspectionAssistant } from '@/components/inspection/VoiceInspectionAssistant';

interface InspectionHeaderProps {
    headerData: any;
    inspMethod: "DIVING" | "ROV";
    setInspMethod: (m: "DIVING" | "ROV") => void;
    inspectionDirection?: "Increase KP" | "Reverse KP";
    setInspectionDirection?: (dir: "Increase KP" | "Reverse KP") => void;
    inspectionLocation?: "Pipeline" | "Crossing Line" | "Others";
    setInspectionLocation?: (loc: "Pipeline" | "Crossing Line" | "Others") => void;
    router: any;
    searchParams: any;
    allInspectionTypes: any[];
    currentRecords: any[];
    generateInspectionReportByType: (id: any) => void;
    generateSeabedReport: (templateId: string) => void;
    generateMGIReport: () => void;
    generateRMGIReport: () => void;
    generateFMDReport: () => void;
    generateSZCIReport: () => void;
    generateUTWTReport: () => void;
    generateRSCORReport: () => void;
    generateRRISIReport: () => void;
    generateJTISIReport: () => void;
    generateITISIReport: () => void;
    generateAnodeReport: () => void;
    generateDivingAnodeReport: () => void;
    generateDivingACFMCReport: () => void;
    generateDivingPLCOReport: () => void;
    generateROVRWDIReport: () => void;
    generateCPReport: () => void;
    generateRSWNIReport: () => void;
    generateRGVIReport: () => void;
    generateGVINSReport: () => void;
    generateRCASNReport: () => void;
    generateSZONEReport: () => void;
    generateCPCLBReport: () => void;
    generateUTCLBReport: () => void;

    generateRCASNSketchReport: () => void;
    generateRCONDReport: () => void;
    generateRCONDSketchReport: () => void;
    generatePipelineEventSketchReport?: () => void;
    generateBLReport: () => void;
    generateRGReport: () => void;
    generateSGReport: () => void;
    generateCUReport: () => void;
    generatePhotographyReport: () => void;
    generatePhotographyLogReport: () => void;
    generateFullInspectionReport: () => void;
    setIsReportWizardOpen: (val: boolean) => void;
    jobPackId?: string | null;
    structureId?: string | null;
    onSummaryOpen?: () => void;
    onResetLayout?: () => void;
    closedPanels?: Array<{ id: string; name: string }>;
    onRestorePanel?: (id: string) => void;
    onRestoreAllPanels?: () => void;
    onUpdateSowReportNo?: (newReportNo: string) => void;
    onOpenGeodetic?: () => void;
    onGlobalVoiceCommand?: (parsedResult: any) => void;
}

export const InspectionHeader: React.FC<InspectionHeaderProps> = ({
    headerData,
    inspMethod,
    setInspMethod,
    inspectionDirection = "Increase KP",
    setInspectionDirection,
    inspectionLocation = "Pipeline",
    setInspectionLocation,
    router,
    searchParams,
    allInspectionTypes = [],
    currentRecords = [],
    generateInspectionReportByType,
    generateSeabedReport,
    generateMGIReport,
    generateRMGIReport,
    generateFMDReport,
    generateSZCIReport,
    generateUTWTReport,
    generateRSCORReport,
    generateRRISIReport,
    generateJTISIReport,
    generateITISIReport,
    generateAnodeReport,
    generateCPReport,
    generateRSWNIReport,
    generateRGVIReport,
    generateGVINSReport,
    generateSZONEReport,
    generateCPCLBReport,
    generateUTCLBReport,
    generateDivingAnodeReport,
    generateDivingACFMCReport,
    generateDivingPLCOReport,
    generateROVRWDIReport,
    generateRCASNReport,
    generateRCASNSketchReport,
    generateRCONDReport,
    generateRCONDSketchReport,
    generatePipelineEventSketchReport,
    generateBLReport,
    generateRGReport,
    generateSGReport,
    generateCUReport,
    generatePhotographyReport,
    generatePhotographyLogReport,
    generateFullInspectionReport,
    setIsReportWizardOpen,
    jobPackId,
    structureId,
    onSummaryOpen,
    onResetLayout,
    closedPanels,
    onRestorePanel,
    onRestoreAllPanels,
    onUpdateSowReportNo,
    onOpenGeodetic,
    onGlobalVoiceCommand
}) => {
    const isPipeline = headerData?.structureType === "pipeline" || headerData?.isPipeline;

    // SOW Report No Edit State
    const [isEditSowOpen, setIsEditSowOpen] = useState(false);
    const [editedReportNo, setEditedReportNo] = useState(headerData.sowReportNo || "");
    const [isSavingSow, setIsSavingSow] = useState(false);

    useEffect(() => {
        setEditedReportNo(headerData.sowReportNo || "");
    }, [headerData.sowReportNo]);

    const handleSaveSowReportNo = async () => {
        const trimmed = editedReportNo.trim();
        if (!trimmed) {
            toast.error("SOW Report No cannot be empty.");
            return;
        }

        if (trimmed === headerData.sowReportNo) {
            setIsEditSowOpen(false);
            return;
        }

        setIsSavingSow(true);
        try {
            const supabase = createClient();
            const oldReportNo = headerData.sowReportNo;

            // 1. Update u_sow table if structure and jobpack are bound
            if (jobPackId && structureId) {
                const { data: sowEntries } = await supabase
                    .from("u_sow")
                    .select("id, report_numbers")
                    .eq("jobpack_id", Number(jobPackId))
                    .eq("structure_id", Number(structureId));

                if (sowEntries && sowEntries.length > 0) {
                    for (const entry of sowEntries) {
                        const updatedReports = (entry.report_numbers || []).map((r: any) => {
                            if (r.number === oldReportNo) {
                                return { ...r, number: trimmed };
                            }
                            return r;
                        });
                        await supabase
                            .from("u_sow")
                            .update({ report_numbers: updatedReports })
                            .eq("id", entry.id);
                    }
                }

                // Update u_sow_items for this jobpack/structure
                await supabase
                    .from("u_sow_items")
                    .update({ report_number: trimmed })
                    .eq("report_number", oldReportNo);
            }

            // 2. Update existing inspection records matching old report no
            if (oldReportNo && oldReportNo !== "N/A" && oldReportNo !== "Unknown Report") {
                await supabase
                    .from("insp_records")
                    .update({ sow_report_no: trimmed })
                    .eq("sow_report_no", oldReportNo);
            }

            // 3. Update URL parameter so the workspace reloads cleanly with the new SOW Report No
            const params = new URLSearchParams(searchParams.toString());
            params.set("sowReportNo", trimmed);
            router.replace(`?${params.toString()}`);

            if (onUpdateSowReportNo) {
                onUpdateSowReportNo(trimmed);
            }

            toast.success(`SOW Report No updated to "${trimmed}"`);
            setIsEditSowOpen(false);
        } catch (err: any) {
            console.error("Failed to update SOW Report No:", err);
            toast.error("Failed to update SOW Report No");
        } finally {
            setIsSavingSow(false);
        }
    };

    return (
        <header className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between shadow-md z-20 shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-3 flex-wrap">
                <Link href={searchParams && searchParams.toString() ? `/dashboard/inspection-v2?${searchParams.toString()}` : "/dashboard/inspection-v2"}>
                    <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8 px-2.5 rounded-md flex items-center gap-1.5 text-xs font-bold shadow-sm">
                        <ArrowLeft className="w-4 h-4" /> <span>Back</span>
                    </Button>
                </Link>
                <div className="h-5 w-px bg-slate-700"></div>

                <h1 className="text-lg font-black uppercase tracking-widest flex items-center gap-2 text-blue-400">
                    <Activity className="w-5 h-5" /> INSPECTION
                </h1>
                <div className="h-5 w-px bg-slate-700"></div>

                <div className="flex bg-slate-800 rounded-md p-0.5 border border-slate-700 h-8 items-center">
                    <button
                        onClick={() => {
                            setInspMethod("DIVING");
                            const params = new URLSearchParams(searchParams.toString());
                            params.set("mode", "DIVING");
                            router.replace(`?${params.toString()}`);
                        }}
                        className={`px-3 py-1 h-7 text-xs font-bold rounded uppercase tracking-wider ${inspMethod === "DIVING" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                        DIVING
                    </button>
                    <button
                        onClick={() => {
                            setInspMethod("ROV");
                            const params = new URLSearchParams(searchParams.toString());
                            params.set("mode", "ROV");
                            router.replace(`?${params.toString()}`);
                        }}
                        className={`px-3 py-1 h-7 text-xs font-bold rounded uppercase tracking-wider ${inspMethod === "ROV" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                        ROV
                    </button>
                </div>

                <VoiceInspectionAssistant
                    inspMethod={inspMethod}
                    structureType={headerData?.structureType || (isPipeline ? 'pipeline' : 'platform')}
                    componentInfo={{
                        name: headerData?.platformName,
                    }}
                    onApplyExtraction={(parsed) => {
                        if (onGlobalVoiceCommand) {
                            onGlobalVoiceCommand(parsed);
                        }
                    }}
                />

                {/* Pipeline Inspection Preset Dropdowns */}
                {isPipeline && (
                    <div className="flex items-center gap-2 bg-slate-950/60 p-0.5 rounded-md border border-slate-800 h-8">
                        {/* Inspection Direction Selector */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm rounded">
                                    <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>DIR: <strong className="text-emerald-300 ml-0.5">{inspectionDirection}</strong></span>
                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-slate-900 border-slate-700 text-slate-200 text-xs min-w-[150px]">
                                <DropdownMenuItem onClick={() => setInspectionDirection?.("Increase KP")} className="cursor-pointer font-bold flex items-center justify-between">
                                    <span>Increase KP</span>
                                    {inspectionDirection === "Increase KP" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setInspectionDirection?.("Reverse KP")} className="cursor-pointer font-bold flex items-center justify-between">
                                    <span>Reverse KP</span>
                                    {inspectionDirection === "Reverse KP" && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Inspection Location / Target Selector */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm rounded">
                                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>LOC: <strong className="text-cyan-300 ml-0.5">{inspectionLocation}</strong></span>
                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-slate-900 border-slate-700 text-slate-200 text-xs min-w-[150px]">
                                <DropdownMenuItem onClick={() => setInspectionLocation?.("Pipeline")} className="cursor-pointer font-bold flex items-center justify-between">
                                    <span>Pipeline</span>
                                    {inspectionLocation === "Pipeline" && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setInspectionLocation?.("Crossing Line")} className="cursor-pointer font-bold flex items-center justify-between">
                                    <span>Crossing Line</span>
                                    {inspectionLocation === "Crossing Line" && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setInspectionLocation?.("Others")} className="cursor-pointer font-bold flex items-center justify-between">
                                    <span>Others</span>
                                    {inspectionLocation === "Others" && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}

                <div className="hidden md:flex items-center text-xs ml-3 space-x-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Jobpack:</span>
                        <span className="font-mono font-bold text-slate-200">{headerData.jobpackName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Structure Title:</span>
                        <span className="font-mono font-bold text-slate-200">{headerData.platformName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700 group">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">SOW Report:</span>
                        <span className="font-mono font-black text-cyan-400">{headerData.sowReportNo}</span>
                        <button
                            onClick={() => {
                                setEditedReportNo(headerData.sowReportNo || "");
                                setIsEditSowOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-700/60 rounded transition-colors"
                            title="Edit / Modify SOW Report No"
                        >
                            <Edit2 className="w-3 h-3" />
                        </button>
                        {headerData.jobType && (
                            <>
                                <span className="text-slate-600 dark:text-slate-500 font-bold px-1">/</span>
                                <Badge variant="outline" className="h-5 px-1.5 bg-blue-500/10 text-cyan-300 border-blue-500/30 text-[9px] font-black uppercase tracking-widest leading-none flex items-center justify-center">
                                    {headerData.jobType}
                                </Badge>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 border-l border-slate-700 pl-3">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Vessel:</span>
                        <span className="font-mono font-bold text-blue-300">{headerData.vessel || "N/A"}</span>
                    </div>
                </div>
            </div>

            {/* Modal Dialog to Edit SOW Report No */}
            <Dialog open={isEditSowOpen} onOpenChange={setIsEditSowOpen}>
                <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-black uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                            <Edit2 className="w-4 h-4 text-cyan-400" /> Modify SOW Report No
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            Update the active SOW Report Number. This will update linked records and the active session header.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current SOW Report No</label>
                            <Input
                                value={editedReportNo}
                                onChange={(e) => setEditedReportNo(e.target.value)}
                                placeholder="Enter Report Number (e.g. REP-2026-01)"
                                className="bg-slate-950 border-slate-700 text-slate-100 font-mono font-bold focus:border-cyan-500 focus:ring-cyan-500/20"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditSowOpen(false)}
                            disabled={isSavingSow}
                            className="text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold uppercase"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSaveSowReportNo}
                            disabled={isSavingSow}
                            className="bg-cyan-600 text-white hover:bg-cyan-500 text-xs font-bold uppercase px-4 shadow-md"
                        >
                            {isSavingSow ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex gap-2 items-center">
                {onOpenGeodetic && isPipeline && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="bg-blue-950/60 border-blue-700/60 text-blue-300 hover:bg-blue-900/70 hover:text-white h-8 w-8 p-0 rounded-md font-bold shadow-md flex items-center justify-center shrink-0"
                        onClick={onOpenGeodetic}
                        title="Geodetic Parameters (Global Positioning & Survey Reference)"
                    >
                        <Globe className="w-4 h-4 text-blue-400" />
                    </Button>
                )}

                <Button
                    variant="outline"
                    size="sm"
                    className="bg-gradient-to-r from-cyan-600 to-teal-600 border-cyan-500 text-white hover:from-cyan-500 hover:to-teal-500 hover:text-white h-8 px-2.5 rounded-md font-bold shadow-md shadow-cyan-900/30 flex items-center gap-1.5 text-[11px]"
                    onClick={onSummaryOpen}
                    title="Inspection Summary Dashboard"
                >
                    <BarChart3 className="w-4 h-4" /> <span>Inspection Summary</span>
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8 px-2.5 rounded-md flex items-center gap-1.5 text-[11px] font-bold"
                            title="Reports Wizard & Report Templates"
                        >
                            <Printer className="w-4 h-4 text-cyan-400" /> <span>Reports</span> <ChevronDown className="w-3 h-3 text-slate-400" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 bg-slate-900 border-slate-700 text-slate-200 shadow-xl">
                        <DropdownMenuItem 
                            onClick={() => setIsReportWizardOpen(true)}
                            className="text-xs font-bold hover:bg-slate-800 cursor-pointer py-2 text-cyan-400 flex items-center gap-2"
                        >
                            <Printer className="w-4 h-4 text-cyan-400" /> Open Report Wizard...
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
 
                {jobPackId && structureId ? (
                    <div className="flex items-center bg-slate-800 rounded-md p-0.5 border border-slate-700 h-8">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className={`text-slate-300 hover:text-white h-7 px-2 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-slate-700/50 rounded transition-all ${
                                        closedPanels && closedPanels.length > 0 ? "bg-amber-500/10 text-amber-300 border border-amber-500/30" : ""
                                    }`}
                                    title="Dock station window settings and layout control"
                                >
                                    <LayoutGrid className={`w-3.5 h-3.5 ${closedPanels && closedPanels.length > 0 ? "text-amber-400" : "text-blue-400"}`} />
                                    <span>Dock Settings</span>
                                    {closedPanels && closedPanels.length > 0 && (
                                        <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-500/30 text-amber-200 border border-amber-500/50 rounded-full leading-none">
                                            {closedPanels.length}
                                        </span>
                                    )}
                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64 bg-slate-900 border-slate-700 text-slate-200 shadow-xl">
                                <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-800 flex items-center justify-between">
                                    <span>Dock Station Controls</span>
                                    {closedPanels && closedPanels.length > 0 ? (
                                        <span className="text-[9px] text-amber-400 font-bold">{closedPanels.length} Closed</span>
                                    ) : (
                                        <span className="text-[9px] text-emerald-400 font-bold">All Open</span>
                                    )}
                                </div>
                                
                                {closedPanels && closedPanels.length > 0 ? (
                                    <>
                                        <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-400 flex items-center justify-between">
                                            <span>Reopen Closed Windows ({closedPanels.length})</span>
                                            {closedPanels.length > 1 && onRestoreAllPanels && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRestoreAllPanels();
                                                    }}
                                                    className="text-[9px] text-blue-400 hover:text-blue-300 font-bold normal-case tracking-normal hover:underline"
                                                >
                                                    Restore All
                                                </button>
                                            )}
                                        </div>
                                        {closedPanels.map((panel) => (
                                            <DropdownMenuItem
                                                key={panel.id}
                                                onClick={() => onRestorePanel?.(panel.id)}
                                                className="text-xs font-medium hover:bg-slate-800 focus:bg-slate-800 cursor-pointer text-slate-200 flex items-center justify-between py-1.5 px-3"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                    {panel.name}
                                                </span>
                                                <span className="text-[9px] font-bold uppercase text-cyan-400 bg-cyan-950/60 border border-cyan-800 px-1.5 py-0.5 rounded hover:bg-cyan-900">
                                                    Open
                                                </span>
                                            </DropdownMenuItem>
                                        ))}
                                        <div className="my-1 border-t border-slate-800" />
                                    </>
                                ) : (
                                    <div className="px-3 py-2 text-[10px] text-slate-400 flex items-center gap-2 border-b border-slate-800/60">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        <span>All workspace panels are open</span>
                                    </div>
                                )}

                                <DropdownMenuItem 
                                    onClick={onResetLayout}
                                    className="text-xs font-semibold hover:bg-slate-800 focus:bg-slate-800 cursor-pointer text-slate-200 py-2 px-3"
                                >
                                    <RotateCcw className="w-3.5 h-3.5 mr-2 text-amber-400" />
                                    <span>Reset All Windows (Default UI)</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <div className="w-px h-4 bg-slate-700 my-auto mx-0.5" />
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="bg-blue-600/90 text-white hover:bg-blue-600 h-7 px-2.5 text-[10px] font-black uppercase tracking-widest rounded"
                            onClick={() => {
                                const structType = headerData.structureType === 'pipeline' ? 'PIPELINE' : 'PLATFORM';
                                const currentUrl = window.location.href;
                                const returnTo = encodeURIComponent(currentUrl);
                                router.push(`/dashboard/jobpack/${jobPackId}?tab=sow&structure=${structType}-${structureId}&returnTo=${returnTo}`);
                            }}
                        >
                            <Grid3X3 className="w-3.5 h-3.5 mr-1" /> Workspace
                        </Button>
                    </div>
                ) : (
                    <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-400 h-8 cursor-not-allowed opacity-50 rounded-md" disabled>
                        <Grid3X3 className="w-4 h-4 mr-2" /> Workspace
                    </Button>
                )}
            </div>
        </header>
    );
};
