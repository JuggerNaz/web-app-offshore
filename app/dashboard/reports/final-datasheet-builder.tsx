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
  Camera
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
      { id: "technical-specs", name: "Technical Specifications", mode: "General" },
      { id: "component-spec", name: "Component Data Sheet", mode: "General" }
  ]},
  { id: 2, name: "General Visual Inspection", templates: [
      { id: "rov-rgvi-report", name: "ROV GVI Report (RGVI)", mode: "ROV" },
      { id: "inspection-report", name: "General Inspection Report", mode: "Diving" }
  ]},
  { id: 3, name: "Cathodic Protection Potential Survey", templates: [
      { id: "rov-cp-report", name: "ROV CP Survey Report", mode: "ROV" }
  ]},
  { id: 4, name: "Flooded Member Detection", templates: [
      { id: "fmd-report", name: "ROV FMD Survey Report", mode: "ROV" }
  ]},
  { id: 5, name: "Attachment Inspection (Conductor, Caisson, Boatlanding)", templates: [
      { id: "rov-rcond-report", name: "ROV Conductor Survey Report", mode: "ROV" },
      { id: "rov-rcasn-report", name: "ROV Caisson Survey Report", mode: "ROV" },
      { id: "rov-bl-report", name: "ROV Boatlanding Survey Report", mode: "ROV" },
      { id: "rov-rg-report", name: "ROV Riser Guard Survey Report", mode: "ROV" },
      { id: "rov-sg-report", name: "ROV Caisson Guard Survey Report", mode: "ROV" },
      { id: "rov-cu-report", name: "ROV Conductor Guard Survey Report", mode: "ROV" },
      { id: "rov-rcond-sketch-report", name: "ROV Conductor Survey (Sketch) Report", mode: "ROV" },
      { id: "rov-rcasn-sketch-report", name: "ROV Caisson Survey (Sketch) Report", mode: "ROV" }
  ]},
  { id: 6, name: "Riser Inspection", templates: [
      { id: "rrisi-report", name: "ROV Riser Survey Report", mode: "ROV" },
      { id: "rov-jtisi-report", name: "ROV J-Tube Inspection Report", mode: "ROV" },
      { id: "rov-itisi-report", name: "ROV I-Tube Inspection Report", mode: "ROV" }
  ]},
  { id: 7, name: "Splashzone Inspection", templates: [
      { id: "szci-report", name: "ROV Splash Zone Inspection", mode: "ROV" }
  ]},
  { id: 8, name: "Anode Inspection", templates: [
      { id: "rov-anode-report", name: "ROV Anode Inspection Report", mode: "ROV" }
  ]},
  { id: 9, name: "Marine Growth Survey", templates: [
      { id: "mgi-report", name: "ROV MGI Survey Report", mode: "ROV" }
  ]},
  { id: 10, name: "Base Level Survey (Scour Survey)", templates: [
      { id: "rov-scour-report", name: "ROV Scour Survey Report", mode: "ROV" }
  ]},
  { id: 11, name: "Debris Survey (Seabed Survey)", templates: [
      { id: "seabed-survey-debris", name: "Seabed Survey For Debris", mode: "General" },
      { id: "seabed-survey-gas", name: "Seabed Survey For Gas Seepage", mode: "General" },
      { id: "seabed-survey-crater", name: "Seabed Survey For Crater", mode: "General" },
      { id: "rov-seabed-report", name: "ROV Seabed Survey Report", mode: "ROV" }
  ]},
  { id: 12, name: "Specified Node Inspection", templates: [] },
  { id: 13, name: "Additional Wall Thickness Inspection", templates: [
      { id: "utwt-report", name: "ROV UT Thickness Report", mode: "ROV" }
  ]},
  { id: 14, name: "Maintenance", templates: [] },
  { id: 15, name: "Cleaning Inspection", templates: [] },
  { id: 16, name: "Photography", templates: [
      { id: "rov-photo-report", name: "ROV Photography Report", mode: "ROV" },
      { id: "rov-photo-log-report", name: "ROV Photography Log Report", mode: "ROV" }
  ]},
  { id: 17, name: "Video", templates: [
      { id: "video-log-report", name: "Video Log Report", mode: "General" },
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

  const renderTocSelection = () => {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Table of Contents Checklist</h2>
          <p className="text-slate-500">Pick relevant documentation sequences.</p>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl divide-y overflow-hidden">
          {TOC_SECTIONS.map((sec, secIdx) => {
            const secTemplates = sec.templates.map(t => t.id);
            const allSelected = secTemplates.every(id => selectedTemplates.includes(id)) && secTemplates.length > 0;
            const someSelected = secTemplates.some(id => selectedTemplates.includes(id)) && !allSelected;

            return (
              <div key={sec.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={allSelected}
                      ref={el => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={(e) => toggleSectionAll(secIdx, e.target.checked)}
                      disabled={sec.templates.length === 0}
                    />
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{sec.name}</span>
                  </div>
                  {sec.templates.length === 0 && <span className="text-xs text-muted-foreground italic">No templates available yet</span>}
                </div>

                {sec.templates.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-6 mt-2">
                    {sec.templates.map((t) => {
                      const isSelected = selectedTemplates.includes(t.id);
                      return (
                        <label key={t.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all ${isSelected ? "border-blue-200 bg-blue-50/30" : "border-slate-100 hover:border-slate-200"}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTemplate(t.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{t.name}</span>
                            <span className={`text-[10px] w-fit px-1 rounded uppercase ${t.mode === 'ROV' ? 'bg-amber-100 text-amber-800' : t.mode === 'Diving' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800'}`}>{t.mode}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={handleBack}><ChevronLeft className="w-4 h-4 mr-1" /> Back</Button>
          <Button onClick={handleNext} disabled={selectedTemplates.length === 0}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
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
