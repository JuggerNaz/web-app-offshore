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
    generateCPReport: () => void;
    generateRGVIReport: () => void;
    generateGVINSReport: () => void;
    generateRCASNReport: () => void;
    generateSZONEReport: () => void;
    generateCPCLBReport: () => void;

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
    jobPackId?: string | null;
    structureId?: string | null;
    onSummaryOpen?: () => void;
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
    generateCPReport,
    generateRGVIReport,
    generateGVINSReport,
    generateRCASNReport,
    generateSZONEReport,
    generateCPCLBReport,

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
    jobPackId,
    structureId,
    onSummaryOpen
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
                                <span className="text-slate-600 font-bold px-1">/</span>
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

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white h-8"><Printer className="w-4 h-4 mr-2" /> Reports</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-1">
                        {/* Grouped Reports */}
                        <div className="px-2 py-1.5 text-[10px] font-black uppercase text-slate-300 tracking-widest border-b border-slate-50 dark:border-slate-800 mb-1">
                            {inspMethod} Report Templates
                        </div>
                        
                        {/* 1. General & Photography */}
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="text-xs py-2 cursor-pointer flex items-center">
                                <Activity className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                                <span>General & Photo</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-56">
                                {inspMethod === 'ROV' && currentRecords.some(r => {
                                    const code = (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase();
                                    return code === 'RGVI';
                                }) && (
                                    <DropdownMenuItem onClick={() => generateRGVIReport()} className="text-xs py-2 cursor-pointer">
                                        ROV General Visual (GVI)
                                    </DropdownMenuItem>
                                )}
                                {inspMethod === 'DIVING' && currentRecords.some(r => {
                                    const code = (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase();
                                    return code === 'DGVI';
                                }) && (
                                    <DropdownMenuItem onClick={() => generateRGVIReport()} className="text-xs py-2 cursor-pointer">
                                        Diving General Visual (GVI)
                                    </DropdownMenuItem>
                                )}
                                {inspMethod === 'DIVING' && currentRecords.some(r => (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase() === 'GVINS') && (
                                    <DropdownMenuItem onClick={() => generateGVINSReport()} className="text-xs py-2 cursor-pointer">
                                        Diving General Visual (GVINS)
                                    </DropdownMenuItem>
                                )}
                                {inspMethod === 'DIVING' && currentRecords.some(r => (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase() === 'SZONE') && (
                                    <DropdownMenuItem onClick={() => generateSZONEReport()} className="text-xs py-2 cursor-pointer">
                                        Diving Splashzone (SZONE)
                                    </DropdownMenuItem>
                                )}

                                {currentRecords.some(r => r.inspection_data?.cp_rdg !== undefined || r.inspection_data?.cp_reading_mv !== undefined) && (
                                    <DropdownMenuItem onClick={() => generateCPReport()} className="text-xs py-2 cursor-pointer">
                                        {inspMethod} CP Survey
                                    </DropdownMenuItem>
                                )}
                                {inspMethod === 'DIVING' && currentRecords.some(r => (r.inspection_type_code || r.inspection_type?.code || '').toUpperCase() === 'CPCLB') && (
                                    <DropdownMenuItem onClick={() => generateCPCLBReport()} className="text-xs py-2 cursor-pointer">
                                        Diving CP Calibration (CPCLB)
                                    </DropdownMenuItem>
                                )}
                                {currentRecords.some(r => (r.structure_components?.code || '').toUpperCase() === 'AN' || (r.structure_components?.metadata?.type || '').toUpperCase() === 'ANODE') && (
                                    <DropdownMenuItem onClick={() => generateAnodeReport()} className="text-xs py-2 cursor-pointer">
                                        {inspMethod} Anode Survey
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => generatePhotographyReport()} className="text-xs py-2 cursor-pointer">
                                    {inspMethod} Photography Report
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => generatePhotographyLogReport()} className="text-xs py-2 cursor-pointer border-t border-slate-50 mt-1">
                                    {inspMethod} Photo Log
                                </DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        {/* 2. Advanced NDT & Survey */}
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="text-xs py-2 cursor-pointer flex items-center">
                                <Activity className="w-3.5 h-3.5 mr-2 text-indigo-600" />
                                <span>NDT & Survey</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-56">
                                {currentRecords.some(r => r.inspection_type_code === (inspMethod === 'ROV' ? 'RFMD' : 'DFMD')) && (
                                    <DropdownMenuItem onClick={() => generateFMDReport()} className="text-xs py-2 cursor-pointer">{inspMethod} FMD Survey</DropdownMenuItem>
                                )}
                                {currentRecords.some(r => r.inspection_type_code === (inspMethod === 'ROV' ? 'RUTWT' : 'DUTWT')) && (
                                    <DropdownMenuItem onClick={() => generateUTWTReport()} className="text-xs py-2 cursor-pointer">{inspMethod} UTWT Survey</DropdownMenuItem>
                                )}
                                {currentRecords.some(r => r.inspection_type_code === (inspMethod === 'ROV' ? 'RMGI' : 'DMGI')) && (
                                    <DropdownMenuItem onClick={() => generateMGIReport()} className="text-xs py-2 cursor-pointer">{inspMethod} MGI Survey</DropdownMenuItem>
                                )}
                                {currentRecords.some(r => r.inspection_type_code === (inspMethod === 'ROV' ? 'RSZCI' : 'DSZCI')) && (
                                    <DropdownMenuItem onClick={() => generateSZCIReport()} className="text-xs py-2 cursor-pointer">{inspMethod} SZCI Survey</DropdownMenuItem>
                                )}
                                {currentRecords.some(r => r.inspection_type_code === (inspMethod === 'ROV' ? 'RSCOR' : 'DSCOR')) && (
                                    <DropdownMenuItem onClick={() => generateRSCORReport()} className="text-xs py-2 cursor-pointer">{inspMethod} Scour Survey</DropdownMenuItem>
                                )}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        {/* 3. Component Specific */}
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="text-xs py-2 cursor-pointer flex items-center">
                                <Activity className="w-3.5 h-3.5 mr-2 text-blue-600" />
                                <span>Structural Components</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-56">
                                {currentRecords.some(r => [inspMethod === 'ROV' ? 'RRISI' : 'DRISI', 'JTISI', 'ITISI'].includes(r.inspection_type_code)) && (
                                    <>
                                        <DropdownMenuItem onClick={() => generateRRISIReport()} className="text-xs py-2 cursor-pointer">{inspMethod} Riser Survey</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => generateJTISIReport()} className="text-xs py-2 cursor-pointer">{inspMethod} J-Tube Inspection</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => generateITISIReport()} className="text-xs py-2 cursor-pointer">{inspMethod} I-Tube Inspection</DropdownMenuItem>
                                    </>
                                )}
                                {currentRecords.some(r => (r.inspection_type_code || '').startsWith(inspMethod === 'ROV' ? 'RCASN' : 'DCASN') || (r.structure_components?.code || '') === 'CS') && (
                                    <>
                                        <DropdownMenuItem onClick={() => generateRCASNReport()} className="text-xs py-2 cursor-pointer border-t border-slate-50 mt-1">{inspMethod} Caisson Survey</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => generateRCASNSketchReport()} className="text-xs py-2 cursor-pointer">{inspMethod} Caisson (Sketch)</DropdownMenuItem>
                                    </>
                                )}
                                {currentRecords.some(r => [(inspMethod === 'ROV' ? 'RCOND' : 'DCOND'), (inspMethod === 'ROV' ? 'RCON' : 'DCON')].includes(r.inspection_type_code) || ['CD', 'CON'].includes(r.structure_components?.code)) && (
                                    <>
                                        <DropdownMenuItem onClick={() => generateRCONDReport()} className="text-xs py-2 cursor-pointer border-t border-slate-50 mt-1">{inspMethod} Conductor Survey</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => generateRCONDSketchReport()} className="text-xs py-2 cursor-pointer">{inspMethod} Conductor (Sketch)</DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        {/* 4. Guards & Boatlanding */}
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="text-xs py-2 cursor-pointer flex items-center">
                                <Activity className="w-3.5 h-3.5 mr-2 text-slate-600" />
                                <span>Guards & Boatlanding</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-56">
                                {currentRecords.some(r => (r.structure_components?.code || '') === 'BL') && (
                                    <DropdownMenuItem onClick={() => generateBLReport()} className="text-xs py-2 cursor-pointer">{inspMethod} Boatlanding Survey</DropdownMenuItem>
                                )}
                                {currentRecords.some(r => ['RG', 'RISERGUARD'].includes(r.inspection_type_code) || (r.structure_components?.code || '') === 'RG') && (
                                    <DropdownMenuItem onClick={() => generateRGReport()} className="text-xs py-2 cursor-pointer">{inspMethod} Riser Guard</DropdownMenuItem>
                                )}
                                {currentRecords.some(r => ['SG', 'CAISSONGUARD'].includes(r.inspection_type_code) || (r.structure_components?.code || '') === 'SG') && (
                                    <DropdownMenuItem onClick={() => generateSGReport()} className="text-xs py-2 cursor-pointer">{inspMethod} Caisson Guard</DropdownMenuItem>
                                )}
                                {currentRecords.some(r => ['CU', 'CONDUCTORGUARD'].includes(r.inspection_type_code) || (r.structure_components?.code || '') === 'CU') && (
                                    <DropdownMenuItem onClick={() => generateCUReport()} className="text-xs py-2 cursor-pointer">{inspMethod} Conductor Guard</DropdownMenuItem>
                                )}
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        {/* Seabed Survey (ROV ONLY) */}
                        {inspMethod === "ROV" && currentRecords.some(r => r.inspection_type_code === 'RSEAB') && (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-xs py-2 cursor-pointer flex items-center">
                                    <Grid3X3 className="w-3.5 h-3.5 mr-2 text-cyan-600" />
                                    <span>ROV Seabed Survey</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-56">
                                    <DropdownMenuItem onClick={() => generateSeabedReport('seabed-survey-debris')} className="text-xs py-2 cursor-pointer">
                                        Debris Survey
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => generateSeabedReport('seabed-survey-gas')} className="text-xs py-2 cursor-pointer">
                                        Gas Seepage
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => generateSeabedReport('seabed-survey-crater')} className="text-xs py-2 cursor-pointer">
                                        Crater Survey
                                    </DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        )}

                        <div className="border-t border-slate-50 dark:border-slate-800 my-1"></div>

                        {/* Dynamic Inspection Reports (Filtered) */}
                        {(() => {
                            const filteredReports = allInspectionTypes.filter(t => 
                                !['RGVI', 'DGVI', 'GVINS', 'SZONE', 'RSEAB', 'RMGI', 'DMGI', 'RFMD', 'DFMD', 'RSZCI', 'DSZCI', 'RUTWT', 'DUTWT', 'RSCOR', 'DSCOR', 'RRISI', 'DRISI', 'RCOND', 'DCOND', 'RCON', 'DCON', 'RG', 'SG', 'CU', 'BL', 'RISERGUARD', 'CAISSONGUARD', 'CONDUCTORGUARD'].includes(t.code) &&
                                currentRecords.some(r => (r.inspection_type_id === t.id || r.inspection_type_code === t.code))
                            ).filter(t => {
                                if (inspMethod === 'DIVING' && t.code.startsWith('R') && t.code.length > 2) return false;
                                if (inspMethod === 'ROV' && t.code.startsWith('D') && t.code.length > 2) return false;
                                return true;
                            });

                            if (filteredReports.length === 0) return null;

                            return (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="text-xs py-2 cursor-pointer flex items-center">
                                        <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-blue-500" />
                                        <span>Other {inspMethod} Reports</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-56 max-h-48">
                                        {filteredReports.map(t => (
                                            <DropdownMenuItem key={t.id} onClick={() => generateInspectionReportByType(t.id)} className="text-xs py-2 cursor-pointer flex items-center justify-between">
                                                <span className="truncate max-w-[140px]">{t.name}</span>
                                                <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-black bg-slate-50 text-slate-400 border-slate-200">{t.code}</Badge>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            );
                        })()}

                        <DropdownMenuItem onClick={() => generateFullInspectionReport()} className="text-xs py-2 cursor-pointer font-bold text-blue-600 border-t border-slate-50 mt-1">
                            <Layout className="w-3.5 h-3.5 mr-2" /> All Captured Records ({inspMethod})
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
