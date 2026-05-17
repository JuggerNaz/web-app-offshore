import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    BarChart3
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
import { ScrollArea } from "@/components/ui/scroll-area";

interface InspectionHeaderProps {
    headerData: any;
    inspMethod: "DIVING" | "ROV";
    setInspMethod: (m: "DIVING" | "ROV") => void;
    router: any;
    searchParams: any;
    allInspectionTypes: any[];
    currentRecords: any[];
    generateInspectionReportByType: (id: any) => void;
    generateSeabedReport: (templateId: string) => void;
    generateMGIReport: () => void;
    generateFMDReport: () => void;
    generateSZCIReport: () => void;
    generateUTWTReport: () => void;
    generateRSCORReport: () => void;
    generateRRISIReport: () => void;
    generateJTISIReport: () => void;
    generateITISIReport: () => void;
    generateAnodeReport: () => void;
    generateDivingAnodeReport: () => void;
    generateCPReport: () => void;
    generateRGVIReport: () => void;
    generateGVINSReport: () => void;
    generateRCASNReport: () => void;
    generateSZONEReport: () => void;
    generateCPCLBReport: () => void;
    generateUTCLBReport: () => void;

    generateRCASNSketchReport: () => void;
    generateRCONDReport: () => void;
    generateRCONDSketchReport: () => void;
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
}

export const InspectionHeader: React.FC<InspectionHeaderProps> = ({
    headerData,
    inspMethod,
    setInspMethod,
    router,
    searchParams,
    allInspectionTypes,
    currentRecords,
    generateInspectionReportByType,
    generateSeabedReport,
    generateMGIReport,
    generateFMDReport,
    generateSZCIReport,
    generateUTWTReport,
    generateRSCORReport,
    generateRRISIReport,
    generateJTISIReport,
    generateITISIReport,
    generateAnodeReport,
    generateDivingAnodeReport,
    generateCPReport,
    generateRGVIReport,
    generateGVINSReport,
    generateRCASNReport,
    generateSZONEReport,
    generateCPCLBReport,
    generateUTCLBReport,

    generateRCASNSketchReport,
    generateRCONDReport,
    generateRCONDSketchReport,
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
    onResetLayout
}) => {
    return (
        <header className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between shadow-md z-20 shrink-0">
            <div className="flex items-center gap-4">
                <h1 className="text-lg font-black uppercase tracking-widest flex items-center gap-2 text-blue-400">
                    <Activity className="w-5 h-5" /> INSPECTION
                </h1>
                <div className="h-5 w-px bg-slate-700"></div>

                <div className="flex bg-slate-800 rounded p-1 mr-4">
                    <button
                        onClick={() => {
                            setInspMethod("DIVING");
                            const params = new URLSearchParams(searchParams.toString());
                            params.set("mode", "DIVING");
                            router.replace(`?${params.toString()}`);
                        }}
                        className={`px-4 py-1 text-xs font-bold rounded uppercase tracking-wider ${inspMethod === "DIVING" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
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
                        className={`px-4 py-1 text-xs font-bold rounded uppercase tracking-wider ${inspMethod === "ROV" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                        ROV
                    </button>
                </div>

                <div className="hidden md:flex items-center text-xs ml-3 space-x-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Jobpack:</span>
                        <span className="font-mono font-bold text-slate-200">{headerData.jobpackName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Structure Title:</span>
                        <span className="font-mono font-bold text-slate-200">{headerData.platformName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">SOW Report:</span>
                        <span className="font-mono font-black text-cyan-400">{headerData.sowReportNo}</span>
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

            <div className="flex gap-2">
                <Link href="/dashboard/inspection-v2"><Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button></Link>

                <Button
                    variant="outline"
                    size="sm"
                    className="bg-gradient-to-r from-cyan-600 to-teal-600 border-cyan-500 text-white hover:from-cyan-500 hover:to-teal-500 hover:text-white h-8 font-bold shadow-md shadow-cyan-900/30"
                    onClick={onSummaryOpen}
                >
                    <BarChart3 className="w-4 h-4 mr-2" /> Inspection Summary
                </Button>

                <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8"
                    onClick={() => setIsReportWizardOpen(true)}
                >
                    <Printer className="w-4 h-4 mr-2" /> Reports
                </Button>
 
                {jobPackId && structureId ? (
                    <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-400 hover:text-white h-7 px-2 text-[10px] font-black uppercase tracking-tighter"
                            onClick={onResetLayout}
                            title="Reset panels to default positions"
                        >
                            Reset UI
                        </Button>
                        <div className="w-px h-4 bg-slate-700 my-auto mx-0.5" />
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="bg-blue-600/90 text-white hover:bg-blue-600 h-7 px-3 text-[10px] font-black uppercase tracking-widest"
                            onClick={() => {
                                const structType = headerData.structureType === 'pipeline' ? 'PIPELINE' : 'PLATFORM';
                                const currentUrl = window.location.href;
                                const returnTo = encodeURIComponent(currentUrl);
                                router.push(`/dashboard/jobpack/${jobPackId}?tab=sow&structure=${structType}-${structureId}&returnTo=${returnTo}`);
                            }}
                        >
                            <Grid3X3 className="w-3.5 h-3.5 mr-1.5" /> Workspace
                        </Button>
                    </div>
                ) : (
                    <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-400 h-8 cursor-not-allowed opacity-50" disabled>
                        <Grid3X3 className="w-4 h-4 mr-2" /> Workspace
                    </Button>
                )}
            </div>
        </header>
    );
};
