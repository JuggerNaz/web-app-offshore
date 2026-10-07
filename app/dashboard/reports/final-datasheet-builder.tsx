"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  Building2, 
  FileText, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  Package,
  Layers,
  Eye,
  CheckSquare,
  Wrench,
  Search,
  Printer,
  Sliders,
  FileCheck,
  Video,
  Camera,
  RotateCcw,
  Filter,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";

const TOC_SECTIONS = [
  { id: 1, name: "Structure Configuration", templates: [
      { id: "structure-summary", name: "Structure Summary Report", mode: "General" },
      { id: "component-catalog", name: "Component Catalogue", mode: "General" },
      { id: "defect-criteria-report", name: "Defect Criteria Report", mode: "General" },
      { id: "component-spec", name: "Component Data Sheet", mode: "General" }
  ]},
  { id: 2, name: "General Visual Inspection", templates: [
      { id: "rov-rgvi-report", name: "General Visual Inspection Report (ROV)", mode: "ROV" },
      { id: "diving-gvins-report", name: "General Visual Inspection Report (Diving)", mode: "Diving" }
  ]},
  { id: 3, name: "Cathodic Protection Potential Survey", templates: [
      { id: "rov-cp-report", name: "CP Survey Report (ROV)", mode: "ROV" },
      { id: "diving-cpsurv-report", name: "CP Survey Report (Diving)", mode: "Diving" },
      { id: "diving-cpclb-report", name: "CP Calibration Report (Diving)", mode: "Diving" }
  ]},
  { id: 4, name: "Flooded Member Detection Survey", templates: [
      { id: "fmd-report", name: "FMD Survey Report (ROV)", mode: "ROV" },
      { id: "diving-fmd-report", name: "FMD Survey Report (Diving)", mode: "Diving" }
  ]},
  { id: 5, name: "Attachment Inspection", templates: [
      { id: "rov-rcond-report", name: "Conductor Survey Report (ROV)", mode: "ROV" },
      { id: "rov-rcasn-report", name: "Caisson Survey Report (ROV)", mode: "ROV" },
      { id: "rov-bl-report", name: "Boatlanding Survey Report (ROV)", mode: "ROV" },
      { id: "rov-rg-report", name: "Riser Guard Survey Report (ROV)", mode: "ROV" },
      { id: "rov-sg-report", name: "Caisson Guard Survey Report (ROV)", mode: "ROV" },
      { id: "rov-cu-report", name: "Conductor Guard Survey Report (ROV)", mode: "ROV" },
      { id: "rov-rcond-sketch-report", name: "Conductor Survey (Sketch) Report (ROV)", mode: "ROV" },
      { id: "rov-rcasn-sketch-report", name: "Caisson Survey (Sketch) Report (ROV)", mode: "ROV" },
      { id: "diving-dcasn-uw-report", name: "Caisson Inspection Underwater (Diving)", mode: "Diving" },
      { id: "diving-dcasn-ts-report", name: "Caisson Inspection Above Water (Diving)", mode: "Diving" },
      { id: "diving-dcond-uw-report", name: "Conductor Inspection Underwater (Diving)", mode: "Diving" },
      { id: "diving-dcond-ts-report", name: "Conductor Inspection Above Water (Diving)", mode: "Diving" },
      { id: "diving-item-report", name: "Item Inspection Report (Diving)", mode: "Diving" },
      { id: "diving-bsins-report", name: "Bolted Support Inspection (Diving)", mode: "Diving" }
  ]},
  { id: 6, name: "Riser Inspection", templates: [
      { id: "rrisi-report", name: "Riser Survey Inspection Sketch Report (ROV)", mode: "ROV" },
      { id: "rrisi-detail-report", name: "Riser Inspection Report (ROV)", mode: "ROV" },
      { id: "rov-jtisi-report", name: "J-Tube Survey Inspection Sketch Report (ROV)", mode: "ROV" },
      { id: "rov-jtisi-detail-report", name: "J-Tube Inspection Report (ROV)", mode: "ROV" },
      { id: "rov-itisi-report", name: "I-Tube Survey Inspection Sketch Report (ROV)", mode: "ROV" },
      { id: "rov-itisi-detail-report", name: "I-Tube Inspection Report (ROV)", mode: "ROV" },
      { id: "diving-rrisi-report", name: "Riser Inspection (Sketch) Report (Diving)", mode: "Diving" },
      { id: "diving-rrisi-detail-report", name: "Riser Inspection Report (Diving)", mode: "Diving" }
  ]},
  { id: 7, name: "Splash Zone Inspection", templates: [
      { id: "szci-report", name: "Splash Zone Inspection Report (ROV)", mode: "ROV" },
      { id: "diving-szone-report", name: "Splash Zone Inspection (Diving)", mode: "Diving" },
      { id: "diving-plco-report", name: "Coating Damage Inspection (Diving)", mode: "Diving" }
  ]},
  { id: 8, name: "Anode Inspection", templates: [
      { id: "rov-anode-report", name: "Anode Inspection Report (ROV)", mode: "ROV" },
      { id: "rov-anode-rsani-report", name: "Selected Anode Report (ROV)", mode: "ROV" },
      { id: "diving-anode-report", name: "Selected Anode Report (Diving)", mode: "Diving" }
  ]},
  { id: 9, name: "Marine Growth Survey", templates: [
      { id: "mgi-report", name: "Marine Growth Graph Report (ROV)", mode: "ROV" },
      { id: "rov-rmgi-report", name: "Marine Growth Inspection Report (ROV)", mode: "ROV" },
      { id: "diving-mgi-report", name: "Marine Growth Inspection Graph Report (Diving)", mode: "Diving" }
  ]},
  { id: 10, name: "Base Level Survey", templates: [
      { id: "rov-rscor-survey-report", name: "Scour Survey Report (ROV)", mode: "ROV" },
      { id: "rov-scour-report", name: "Scour Survey Sketch Report (ROV)", mode: "ROV" },
      { id: "rov-rwdi-report", name: "Water Depth Measurement Survey Report (ROV)", mode: "ROV" },
      { id: "rov-ricmi-report", name: "Inclinometer Reading Inspection Report (ROV)", mode: "ROV" }
  ]},
  { id: 11, name: "Seabed Survey", templates: [
      { id: "seabed-survey-debris", name: "Seabed Survey Debris Sketch Report (ROV)", mode: "General" },
      { id: "seabed-survey-gas", name: "Seabed Survey Gas Seepage Sketch Report (ROV)", mode: "General" },
      { id: "seabed-survey-crater", name: "Seabed Survey Crater Sketch Report (ROV)", mode: "General" },
      { id: "rov-seabed-report", name: "Seabed Survey Inspection Sketch Report (ROV)", mode: "ROV" },
      { id: "rov-rseab-detail-report", name: "Seabed Survey Debris Inspection Report (ROV)", mode: "ROV" },
      { id: "rov-rseab-gas-detail-report", name: "Seabed Survey Gas Seepage Inspection Report (ROV)", mode: "ROV" },
      { id: "rov-rseab-crater-detail-report", name: "Seabed Survey Crater Inspection Report (ROV)", mode: "ROV" }
  ]},
  { id: 12, name: "Specified Node Inspection", templates: [
      { id: "rov-selected-node-report", name: "Selected Node Report (ROV)", mode: "ROV" },
      { id: "diving-cvins-report", name: "Close Visual Inspection (Diving)", mode: "Diving" },
      { id: "diving-mpins-report", name: "Magnetic Particle Inspection (Diving)", mode: "Diving" },
      { id: "diving-acfmc-report", name: "ACFM Inspection (Diving)", mode: "Diving" }
  ] },
  { id: 13, name: "Additional Wall Thickness Inspection", templates: [
      { id: "utwt-report", name: "UT Thickness Report (ROV)", mode: "ROV" },
      { id: "diving-utwtk-report", name: "UT Wall Thickness Inspection (Diving)", mode: "Diving" },
      { id: "diving-utclb-report", name: "UT Calibration Report (Diving)", mode: "Diving" }
  ]},
  { id: 14, name: "Maintenance", templates: [
      { id: "diving-itmain-report", name: "Item Maintenance Inspection Report (Diving)", mode: "Diving" },
      { id: "diving-anmain-report", name: "Anode Maintenance Inspection Report (Diving)", mode: "Diving" }
  ]},
  { id: 15, name: "Cleaning Inspection", templates: [
      { id: "diving-clean-report", name: "Cleaning Inspection (Diving)", mode: "Diving" }
  ]},
  { id: 16, name: "Photography", templates: [
      { id: "rov-photo-report", name: "Photography Report (ROV)", mode: "ROV" },
      { id: "rov-photo-log-report", name: "Photography Log Report (ROV)", mode: "ROV" }
  ]},
  { id: 17, name: "Video", templates: [
      { id: "video-log-report", name: "Video Log Report (ROV)", mode: "General" },
      { id: "diver-log-report", name: "Diver Log Report", mode: "Diving" }
  ]},
  { id: 18, name: "Anomaly", templates: [
      { id: "defect-summary", name: "Defect Summary Report", mode: "General" },
      { id: "findings-summary", name: "Findings Summary Report", mode: "General" },
      { id: "defect-anomaly-report", name: "Defect / Anomaly Report", mode: "General" },
      { id: "findings-report", name: "Findings Report", mode: "General" }
  ]}
];

interface ConfigState {
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  printFriendly: boolean;
  coverPages: boolean;
}

export function FinalDatasheetBuilder() {
  const [step, setStep] = useState<"option" | "context" | "toc" | "config" | "preview">("option");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // Selection State
  const [jobPackId, setJobPackId] = useState("");
  const [structureId, setStructureId] = useState("");
  const [sowReportNo, setSowReportNo] = useState("");
  
  // TOC Checklist - store selected template IDs
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>(() => {
    // Select all templates by default
    const allIds: string[] = [];
    TOC_SECTIONS.forEach(sec => sec.templates.forEach(t => allIds.push(t.id)));
    return allIds;
  });

  const [tocSearch, setTocSearch] = useState("");
  const [tocModeFilter, setTocModeFilter] = useState<"all" | "ROV" | "Diving" | "General" | "selected">("all");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Config State
  const [config, setConfig] = useState<ConfigState>({
    preparedBy: "",
    reviewedBy: "",
    approvedBy: "",
    printFriendly: false,
    coverPages: true
  });

  // Data Queries
  const { data: jobPacksData } = useSWR("/api/jobpack?limit=1000&has_inspection=true", fetcher);
  const { data: structuresData } = useSWR("/api/structures", fetcher);
  const [inspectionFilters, setInspectionFilters] = useState<{ structure_id: number; sow_report_no: string }[]>([]);

  const jobPacks = jobPacksData?.data || [];
  const structures = structuresData?.data || [];

  useEffect(() => {
    if (jobPackId) {
      fetch(`/api/reports/inspection-filters?jobpack_id=${jobPackId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data) setInspectionFilters(data.data);
          else setInspectionFilters([]);
        })
        .catch(() => setInspectionFilters([]));
    } else {
      setInspectionFilters([]);
    }
  }, [jobPackId]);

  const filteredStructures = useMemo(() => {
    if (inspectionFilters.length === 0) return [];
    const validIds = Array.from(new Set(inspectionFilters.map(f => f.structure_id)));
    return structures.filter((s: any) => validIds.includes(s.id));
  }, [structures, inspectionFilters]);

  const availableSowReports = useMemo(() => {
    if (!structureId) return [];
    const validSows = inspectionFilters
      .filter(f => f.structure_id.toString() === structureId && f.sow_report_no)
      .map(f => f.sow_report_no);
    return Array.from(new Set(validSows));
  }, [structureId, inspectionFilters]);

  const toggleTemplate = (id: string) => {
    setSelectedTemplates(prev => 
      prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
    );
  };

  const toggleSectionAll = (sectionIndex: number, checked: boolean) => {
    const secTemplates = TOC_SECTIONS[sectionIndex].templates.map(t => t.id);
    if (checked) {
      setSelectedTemplates(prev => Array.from(new Set([...prev, ...secTemplates])));
    } else {
      setSelectedTemplates(prev => prev.filter(id => !secTemplates.includes(id)));
    }
  };

  const handleNext = () => {
    if (step === "option") setStep("context");
    else if (step === "context") setStep("toc");
    else if (step === "toc") setStep("config");
    else if (step === "config") setStep("preview");
  };

  const handleBack = () => {
    if (step === "context") setStep("option");
    else if (step === "toc") setStep("context");
    else if (step === "config") setStep("toc");
    else if (step === "preview") setStep("config");
  };

  const renderOptionSelection = () => {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4 py-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Select Final Report Option</h2>
          <p className="text-slate-500">Pick standard documentation bundles.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            onClick={() => { setSelectedOption("inspection"); setStep("context"); }}
            className={`cursor-pointer transition-all border-2 flex flex-col items-center justify-center p-6 text-center gap-4 ${selectedOption === "inspection" ? "border-blue-500 bg-blue-50/50" : "hover:border-slate-300 border-transparent bg-white dark:bg-slate-950"}`}
          >
            <FileCheck className="w-12 h-12 text-blue-500" />
            <div className="font-bold text-lg text-slate-800 dark:text-slate-100">Final Inspection Datasheet</div>
            <p className="text-xs text-muted-foreground">Comprehensive survey aggregation book.</p>
          </Card>
        </div>
      </div>
    );
  };

  const renderContextSelection = () => {
    const PanelContainer = ({ children, title, disabled }: any) => (
      <div className={`flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 overflow-hidden h-[450px] transition-opacity ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="p-4 border-b bg-slate-50/50 dark:bg-slate-900/50">
          <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            {title}
          </Label>
        </div>
        {children}
      </div>
    );

    return (
      <div className="space-y-6 max-w-6xl mx-auto w-full p-4">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Scope Selector</h2>
          <p className="text-slate-500">Pick references targeting operations.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PanelContainer title="Job Pack">
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30">
              {jobPacks.map((jp: any) => {
                const isSelected = jobPackId === jp.id.toString();
                return (
                  <div
                    key={jp.id}
                    onClick={() => { setJobPackId(jp.id.toString()); setStructureId(""); setSowReportNo(""); }}
                    className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between ${isSelected ? "border-blue-500 bg-blue-50" : "border-transparent hover:bg-slate-100"}`}
                  >
                    <span className="text-sm font-medium">{jp.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                  </div>
                );
              })}
            </div>
          </PanelContainer>

          <PanelContainer title="Structure" disabled={!jobPackId}>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30">
              {filteredStructures.map((s: any) => {
                const isSelected = structureId === s.id.toString();
                return (
                  <div
                    key={s.id}
                    onClick={() => { setStructureId(s.id.toString()); setSowReportNo(""); }}
                    className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between ${isSelected ? "border-blue-500 bg-blue-50" : "border-transparent hover:bg-slate-100"}`}
                  >
                    <span className="text-sm font-medium">{s.str_name}</span>
                    {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                  </div>
                );
              })}
            </div>
          </PanelContainer>

          <PanelContainer title="SOW Report No" disabled={!structureId}>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/30">
              {availableSowReports.map((reportNo, idx) => {
                const isSelected = sowReportNo === reportNo;
                return (
                  <div
                    key={`${reportNo}-${idx}`}
                    onClick={() => setSowReportNo(reportNo)}
                    className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between ${isSelected ? "border-blue-500 bg-blue-50" : "border-transparent hover:bg-slate-100"}`}
                  >
                    <span className="text-sm font-medium">{reportNo}</span>
                    {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                  </div>
                );
              })}
            </div>
          </PanelContainer>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={handleNext} disabled={!jobPackId || !structureId || !sowReportNo}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  };

  const allTocTemplates = useMemo(() => {
    return TOC_SECTIONS.flatMap(sec => sec.templates);
  }, []);

  const selectAllTemplates = () => {
    setSelectedTemplates(allTocTemplates.map(t => t.id));
  };

  const deselectAllTemplates = () => {
    setSelectedTemplates([]);
  };

  const selectTemplatesByMode = (mode: string) => {
    const modeTemplateIds = allTocTemplates
      .filter(t => t.mode?.toLowerCase() === mode.toLowerCase())
      .map(t => t.id);
    setSelectedTemplates(prev => Array.from(new Set([...prev, ...modeTemplateIds])));
  };

  const toggleCollapseSection = (secId: number) => {
    setCollapsedSections(prev => ({
      ...prev,
      [secId]: !prev[secId]
    }));
  };

  const expandAllSections = () => {
    setCollapsedSections({});
  };

  const collapseAllSections = () => {
    const allCollapsed: Record<string, boolean> = {};
    TOC_SECTIONS.forEach(s => {
      allCollapsed[s.id] = true;
    });
    setCollapsedSections(allCollapsed);
  };

  const renderTocSelection = () => {
    const totalCount = allTocTemplates.length;
    const selectedCount = selectedTemplates.length;
    const selectionPercent = totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0;

    const rovCount = allTocTemplates.filter(t => t.mode?.toLowerCase() === "rov").length;
    const divingCount = allTocTemplates.filter(t => t.mode?.toLowerCase() === "diving").length;
    const generalCount = allTocTemplates.filter(t => t.mode?.toLowerCase() === "general").length;

    // Filter sections and templates based on search & mode filter
    const filteredSections = TOC_SECTIONS.map((sec, secIdx) => {
      const matchesSearch = (text: string) => 
        !tocSearch.trim() || text.toLowerCase().includes(tocSearch.trim().toLowerCase());

      const matchingTemplates = sec.templates.filter(t => {
        const matchesText = matchesSearch(t.name) || matchesSearch(t.mode) || matchesSearch(sec.name) || matchesSearch(t.id);
        if (!matchesText) return false;

        if (tocModeFilter === "all") return true;
        if (tocModeFilter === "selected") return selectedTemplates.includes(t.id);
        return t.mode?.toLowerCase() === tocModeFilter.toLowerCase();
      });

      return {
        ...sec,
        originalIndex: secIdx,
        filteredTemplates: matchingTemplates,
        hasMatches: matchingTemplates.length > 0 || (sec.templates.length === 0 && matchesSearch(sec.name))
      };
    }).filter(sec => sec.hasMatches);

    return (
      <div className="space-y-6 max-w-5xl mx-auto p-4 pb-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-1">
            <FileCheck className="w-3.5 h-3.5" />
            <span>Step 3: Document Sequencing</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Table of Contents Checklist
          </h2>
          <p className="text-sm text-slate-500 max-w-lg mx-auto">
            Pick relevant documentation sequences to include in your datasheet package.
          </p>
        </div>

        {/* Dashboard Toolbar */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-4">
          {/* Top Row: Search & Progress Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search report name, mode, or section (e.g., 'CP', 'FMD', 'ROV')..."
                value={tocSearch}
                onChange={(e) => setTocSearch(e.target.value)}
                className="pl-9 pr-9 h-10 text-sm bg-slate-50/50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl"
              />
              {tocSearch && (
                <button
                  onClick={() => setTocSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800 justify-between md:justify-start">
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Selected Items
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span className="text-blue-600 dark:text-blue-400">{selectedCount}</span>
                  <span className="text-slate-400 font-normal">/</span>
                  <span>{totalCount}</span>
                  <span className="text-xs text-slate-400 font-normal">({selectionPercent}%)</span>
                </span>
              </div>
              <div className="w-24 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${selectionPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Middle Row: Mode Filters & Global Select Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter:
              </span>

              <button
                onClick={() => setTocModeFilter("all")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  tocModeFilter === "all"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                All ({totalCount})
              </button>

              <button
                onClick={() => setTocModeFilter("ROV")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  tocModeFilter === "ROV"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/50 hover:bg-amber-100"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                ROV ({rovCount})
              </button>

              <button
                onClick={() => setTocModeFilter("Diving")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  tocModeFilter === "Diving"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/50 hover:bg-indigo-100"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                Diving ({divingCount})
              </button>

              <button
                onClick={() => setTocModeFilter("General")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  tocModeFilter === "General"
                    ? "bg-slate-700 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                General ({generalCount})
              </button>

              <button
                onClick={() => setTocModeFilter("selected")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  tocModeFilter === "selected"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50 hover:bg-blue-100"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                Selected ({selectedCount})
              </button>
            </div>

            {/* Batch Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={selectAllTemplates}
                className="h-8 text-xs gap-1.5 font-medium border-slate-200 dark:border-slate-800 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
              >
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                Select All
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={deselectAllTemplates}
                disabled={selectedCount === 0}
                className="h-8 text-xs gap-1.5 font-medium border-slate-200 dark:border-slate-800 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear All
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const anyCollapsed = Object.values(collapsedSections).some(Boolean);
                  if (anyCollapsed) {
                    expandAllSections();
                  } else {
                    collapseAllSections();
                  }
                }}
                className="h-8 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                {Object.values(collapsedSections).some(Boolean) ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 mr-1" /> Expand All
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 mr-1" /> Collapse All
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Select Presets Bar */}
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-slate-500">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Quick Select:</span>
          <button
            onClick={() => selectTemplatesByMode("rov")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/70 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-medium transition-colors"
          >
            + All ROV Reports ({rovCount})
          </button>
          <button
            onClick={() => selectTemplatesByMode("diving")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100/70 hover:bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 font-medium transition-colors"
          >
            + All Diving Reports ({divingCount})
          </button>
          <button
            onClick={() => selectTemplatesByMode("general")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium transition-colors"
          >
            + All General Reports ({generalCount})
          </button>
        </div>

        {/* Main List */}
        {filteredSections.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              No report templates found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No reports match your current search query <b>"{tocSearch}"</b> or mode filter.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTocSearch("");
                setTocModeFilter("all");
              }}
              className="mt-2 text-xs"
            >
              Reset Search & Filters
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSections.map((sec) => {
              const secTemplates = sec.templates.map(t => t.id);
              const secSelectedTemplates = sec.templates.filter(t => selectedTemplates.includes(t.id));
              const allSelected = secTemplates.length > 0 && secSelectedTemplates.length === secTemplates.length;
              const someSelected = secSelectedTemplates.length > 0 && !allSelected;
              const isCollapsed = !!collapsedSections[sec.id];

              return (
                <div
                  key={sec.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700"
                >
                  {/* Section Header */}
                  <div className="p-4 bg-slate-50/70 dark:bg-slate-900/90 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 select-none">
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        id={`sec-${sec.id}`}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={allSelected}
                        ref={el => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={(e) => toggleSectionAll(sec.originalIndex, e.target.checked)}
                        disabled={sec.templates.length === 0}
                      />
                      <label
                        htmlFor={`sec-${sec.id}`}
                        className="font-bold text-slate-900 dark:text-slate-100 text-sm md:text-base cursor-pointer hover:text-blue-600 transition-colors flex items-center gap-2 truncate"
                      >
                        <span>{sec.name}</span>
                      </label>
                      <Badge
                        variant="secondary"
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          allSelected
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                            : someSelected
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {secSelectedTemplates.length}/{sec.templates.length} selected
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {sec.templates.length > 0 && (
                        <button
                          onClick={() => toggleSectionAll(sec.originalIndex, !allSelected)}
                          className="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:inline-block"
                        >
                          {allSelected ? "Clear Section" : "Select All in Section"}
                        </button>
                      )}

                      <button
                        onClick={() => toggleCollapseSection(sec.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                        title={isCollapsed ? "Expand section" : "Collapse section"}
                      >
                        {isCollapsed ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Section Item Cards */}
                  {!isCollapsed && (
                    <div className="p-4">
                      {sec.templates.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-2">
                          No templates configured for this section yet.
                        </p>
                      ) : sec.filteredTemplates.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-2">
                          No reports in this section match the current search or filter.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {sec.filteredTemplates.map((t) => {
                            const isSelected = selectedTemplates.includes(t.id);
                            const isROV = t.mode?.toLowerCase() === "rov";
                            const isDiving = t.mode?.toLowerCase() === "diving";

                            return (
                              <div
                                key={t.id}
                                onClick={() => toggleTemplate(t.id)}
                                className={`group relative flex items-start gap-3 p-3.5 rounded-xl cursor-pointer border transition-all duration-200 select-none ${
                                  isSelected
                                    ? "border-blue-500/80 bg-blue-50/70 dark:bg-blue-950/40 shadow-sm ring-1 ring-blue-500/20"
                                    : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60 hover:bg-slate-50/50"
                                }`}
                              >
                                {/* Custom Checkbox */}
                                <div className="pt-0.5 shrink-0">
                                  <div
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                      isSelected
                                        ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 group-hover:border-blue-400"
                                    }`}
                                  >
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                </div>

                                {/* Item Info */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className={`text-sm font-semibold leading-tight line-clamp-2 ${
                                      isSelected ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-slate-200"
                                    }`}>
                                      {t.name}
                                    </span>
                                    <span
                                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
                                        isROV
                                          ? "bg-amber-100 text-amber-800 border border-amber-200/70 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-900/50"
                                          : isDiving
                                          ? "bg-indigo-100 text-indigo-800 border border-indigo-200/70 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-900/50"
                                          : "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                      }`}
                                    >
                                      {t.mode}
                                    </span>
                                  </div>

                                  {t.id && (
                                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 block truncate">
                                      ID: {t.id}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step Navigation Controls */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button variant="outline" onClick={handleBack} className="gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <Button onClick={handleNext} disabled={selectedTemplates.length === 0} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderConfigStep = () => {
    return (
      <div className="space-y-6 max-w-2xl mx-auto p-4">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Properties Setup</h2>
          <p className="text-slate-500">Configure visual headers or printing protocols.</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Prepared By</Label>
                <Input value={config.preparedBy} onChange={(e) => setConfig({...config, preparedBy: e.target.value})} placeholder="Technician Name" />
              </div>
              <div className="space-y-2">
                <Label>Reviewed By</Label>
                <Input value={config.reviewedBy} onChange={(e) => setConfig({...config, reviewedBy: e.target.value})} placeholder="Inspector Name" />
              </div>
              <div className="space-y-2">
                <Label>Approved By</Label>
                <Input value={config.approvedBy} onChange={(e) => setConfig({...config, approvedBy: e.target.value})} placeholder="Project Manager" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Label>Print Friendly Mode (Save Ink)</Label>
              <Switch checked={config.printFriendly} onCheckedChange={(c) => setConfig({...config, printFriendly: c})} />
            </div>

            <div className="flex items-center justify-between">
              <Label>Include Custom Cover Pages</Label>
              <Switch checked={config.coverPages} onCheckedChange={(c) => setConfig({...config, coverPages: c})} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={handleBack}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
          <Button onClick={handleNext}>Generate Preview <ChevronRight className="w-4 h-4 ml-1" /></Button>
        </div>
      </div>
    );
  };

  const renderPreviewStep = () => {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Final Verification</h2>
          <p className="text-slate-500">Ready to build compiled tech sheets.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="hover:border-blue-500 cursor-pointer transition-all border-2 border-transparent">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
              <FileText className="w-12 h-12 text-blue-500" />
              <div className="font-semibold text-lg">Consolidated tech report package</div>
              <p className="text-xs text-muted-foreground">Creates a sequentially ordered PDF book mapping selected sections.</p>
              <Button className="mt-2 w-full" onClick={() => alert("Consolidating streams safely...")}>Compile All-In-One PDF</Button>
            </CardContent>
          </Card>

          <Card className="hover:border-blue-500 cursor-pointer transition-all border-2 border-transparent">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
              <Printer className="w-12 h-12 text-teal-500" />
              <div className="font-semibold text-lg">Download templates individually</div>
              <p className="text-xs text-muted-foreground">Extract targeted datasheet modules respectively.</p>
              <Button variant="secondary" className="mt-2 w-full" onClick={() => alert("Exporting subsets...")}>Trigger File Queries</Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-start mt-4">
          <Button variant="outline" onClick={handleBack}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-900/10 overflow-y-auto">
      {step === "option" && renderOptionSelection()}
      {step === "context" && renderContextSelection()}
      {step === "toc" && renderTocSelection()}
      {step === "config" && renderConfigStep()}
      {step === "preview" && renderPreviewStep()}
    </div>
  );
}
