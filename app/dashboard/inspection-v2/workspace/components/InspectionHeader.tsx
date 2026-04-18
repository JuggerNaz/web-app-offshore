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
    Grid3X3
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
    generateFullInspectionReport: () => void;
    jobPackId?: string | null;
    structureId?: string | null;
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
    generateFullInspectionReport,
    jobPackId,
    structureId
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
                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Jobpack:</span>
                        <span className="font-mono font-bold text-slate-200">{headerData.jobpackName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Structure Title:</span>
                        <span className="font-mono font-bold text-slate-200">{headerData.platformName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700">
                        <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">SOW Report:</span>
                        <span className="font-mono font-black text-cyan-400">{headerData.sowReportNo}</span>
                        {headerData.jobType && (
                            <>
                                <span className="text-slate-600 font-bold px-1">/</span>
                                <Badge variant="outline" className="h-5 px-1.5 bg-blue-500/10 text-cyan-300 border-blue-500/30 text-[9px] font-black uppercase tracking-widest leading-none flex items-center justify-center">
                                    {headerData.jobType}
                                </Badge>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex gap-2">
                <Link href="/dashboard/inspection-v2"><Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Button></Link>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8"><Printer className="w-4 h-4 mr-2" /> Reports</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-1">
                        <div className="px-2 py-1.5 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50 mb-1">Inspection Reports</div>
                        <ScrollArea className="h-48">
                            {allInspectionTypes.filter(t => t.code !== 'RSEAB' && t.code !== 'RMGI' && currentRecords.some(r => (r.inspection_type_id === t.id || r.inspection_type_code === t.code))).map(t => (
                                <DropdownMenuItem key={t.id} onClick={() => generateInspectionReportByType(t.id)} className="text-xs py-2 cursor-pointer flex items-center justify-between">
                                    <div className="flex items-center">
                                        <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-blue-500" />
                                        <span className="truncate max-w-[140px]">{t.name}</span>
                                    </div>
                                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-black bg-slate-50 text-slate-400 border-slate-200">{t.code}</Badge>
                                </DropdownMenuItem>
                            ))}
                        </ScrollArea>
                        <div className="border-t border-slate-50 my-1"></div>
                        
                        {currentRecords.some(r => r.inspection_type_code === 'RSEAB' || r.inspection_type?.code === 'RSEAB') && (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-xs py-2 cursor-pointer flex items-center">
                                    <Grid3X3 className="w-3.5 h-3.5 mr-2 text-cyan-600" />
                                    <span>Seabed Survey Reports</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-56">
                                    <DropdownMenuItem onClick={() => generateSeabedReport('seabed-survey-debris')} className="text-xs py-2 cursor-pointer">
                                        Seabed Survey (Debris)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => generateSeabedReport('seabed-survey-gas')} className="text-xs py-2 cursor-pointer">
                                        Seabed Survey (Gas Seepage)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => generateSeabedReport('seabed-survey-crater')} className="text-xs py-2 cursor-pointer">
                                        Seabed Survey (Crater)
                                    </DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        )}

                        {currentRecords.some(r => r.inspection_type_code === 'RMGI' || r.inspection_type?.code === 'RMGI') && (
                            <DropdownMenuItem onClick={() => generateMGIReport()} className="text-xs py-2 cursor-pointer font-bold text-teal-600 border-t border-slate-50 mt-1">
                                <Activity className="w-3.5 h-3.5 mr-2" /> ROV MGI Survey Report
                            </DropdownMenuItem>
                        )}

                        <DropdownMenuItem onClick={() => generateFullInspectionReport()} className="text-xs py-2 cursor-pointer font-bold text-blue-600">
                            <Layout className="w-3.5 h-3.5 mr-2" /> All Captured Records
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {jobPackId && structureId ? (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-blue-600 border-blue-700 text-white hover:bg-blue-700 hover:text-white h-8"
                        onClick={() => {
                            const structType = headerData.structureType === 'pipeline' ? 'PIPELINE' : 'PLATFORM';
                            const currentUrl = window.location.href;
                            const returnTo = encodeURIComponent(currentUrl);
                            router.push(`/dashboard/jobpack/${jobPackId}?tab=sow&structure=${structType}-${structureId}&returnTo=${returnTo}`);
                        }}
                    >
                        <Grid3X3 className="w-4 h-4 mr-2" /> Workspace
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-400 h-8 cursor-not-allowed opacity-50" disabled>
                        <Grid3X3 className="w-4 h-4 mr-2" /> Workspace
                    </Button>
                )}
            </div>
        </header>
    );
};
